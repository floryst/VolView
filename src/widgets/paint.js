import vtkPaintFilter from 'vtk.js/Sources/Filters/General/PaintFilter';
import { SlicingMode } from 'vtk.js/Sources/Rendering/Core/ImageMapper/Constants';
import vtkPaintWidget from '@/src/vtk/PaintWidget';
import { NO_SELECTION } from '@/src/constants';
import {
  onUnFocus,
  onAddedToView,
  onDeleted,
  onBeforeRemoveFromView,
} from './context';
import { computed, unref, watchEffect } from './reactivity';
import {
  useCurrentView,
  usePlaneManipulator,
  useComputedState,
} from './widgetHooks';

function setupHandleDirectionUpdater(factory) {
  const manipulator = factory.getManipulator();
  const manipulatorSub = manipulator.onModified(() => {
    const state = factory.getWidgetState();
    const dir = manipulator.getNormal(); // assumes manipulator has a direction
    state.getHandle().setDirection(dir);
  });

  onDeleted(() => {
    manipulatorSub.unsubscribe();
  });
}

function setupInteractionHandler(context, paintFilterRef, labelmapRef) {
  const { store } = context;

  const viewSubs = new Map();

  onAddedToView(({ widgetState, viewWidget, view }) => {
    const subs = [
      viewWidget.onStartInteractionEvent(() => {
        if (paintFilterRef.value) {
          const filter = paintFilterRef.value;
          const mode = SlicingMode['XYZ'[view.getAxis()]];
          filter.setSlicingMode(mode);
          filter.startStroke();
          filter.addPoint(widgetState.getTrueOrigin());
        }
      }),

      viewWidget.onInteractionEvent(() => {
        if (paintFilterRef.value && viewWidget.getPainting()) {
          paintFilterRef.value.addPoint(widgetState.getTrueOrigin());
        }
      }),

      viewWidget.onEndInteractionEvent(async () => {
        if (paintFilterRef.value) {
          paintFilterRef.value.addPoint(widgetState.getTrueOrigin());
          paintFilterRef.value.endStroke();

          await store.dispatch(
            'visualization/redrawPipeline',
            labelmapRef.value
          );
        }
      }),
    ];

    viewSubs.set(view, subs);
  });

  onBeforeRemoveFromView(({ view }) => {
    const subs = viewSubs.get(view) ?? [];
    while (subs.length) {
      subs.pop().unsubscribe();
    }
    viewSubs.delete(view);
  });
}

function updateVisibility(context, currentView, currentLabelmap) {
  const curView = unref(currentView);
  const curLabelmap = unref(currentLabelmap);
  const { widgetInstances, viewTypeMap } = context;

  const views = Array.from(widgetInstances.keys());
  views.forEach((otherView) => {
    let visible = false;
    if (widgetInstances.has(otherView)) {
      // handle views of the same type
      if (curView && viewTypeMap.has(curView)) {
        const viewType = viewTypeMap.get(curView);
        visible = viewTypeMap.get(otherView) === viewType;
      } else {
        visible = false;
      }

      if (curLabelmap === NO_SELECTION) {
        visible = false;
      }

      const viewWidget = widgetInstances.get(otherView);
      viewWidget.setVisibility(visible);
      viewWidget.setContextVisibility(visible);

      otherView.getReferenceByName('widgetManager').renderWidgets();
      otherView.getRenderWindow().render();
    }
  });
}

function configurePaintFilter(
  context,
  filterRef,
  currentLabelRef,
  baseImageRef,
  labelmapRef
) {
  const { store } = context;
  const filter = unref(filterRef);
  const currentLabel = unref(currentLabelRef);
  const baseImageId = unref(baseImageRef);
  const labelmapId = unref(labelmapRef);
  if (
    baseImageId !== NO_SELECTION &&
    labelmapId !== NO_SELECTION &&
    filter
  ) {
    const { vtkCache } = store.state.data;
    const { imageParams } = store.state.visualization;

    filter.setBackgroundImage(vtkCache[baseImageId]);
    filter.setLabelMap(vtkCache[labelmapId]);
    filter.setMaskWorldToIndex(imageParams.worldToIndex);
    filter.setLabel(currentLabel);
  }
}

export default {
  setup(context) {
    const { store, deleteSelf } = context;

    const widgetFactory = vtkPaintWidget.newInstance();

    const currentLabelmap = useComputedState(store, (state) => {
      const { selectedBaseImage } = state;
      const { currentLabelmapForImage } = state.annotations;
      if (selectedBaseImage in currentLabelmapForImage) {
        return currentLabelmapForImage[selectedBaseImage];
      }
      return NO_SELECTION;
    });
    const currentBaseImage = useComputedState(
      store,
      (state) => state.selectedBaseImage
    );
    const currentLabel = useComputedState(store, (state) => {
      const { selectedBaseImage } = state;
      const { currentLabelmapForImage } = state.annotations;
      const labelmap = currentLabelmapForImage[selectedBaseImage];
      const { paintContexts } = state.annotations;
      if (labelmap in paintContexts) {
        return paintContexts[labelmap].currentLabel;
      }
      return 0;
    });

    const paintFilter = computed(() => {
      // new filter every time the labelmap changes
      if (currentLabelmap.value !== NO_SELECTION) {
        return vtkPaintFilter.newInstance();
      }
      return null;
    });

    // put widget on slice plane

    const { planeNormal, planeOrigin } = usePlaneManipulator(store);

    watchEffect(() => {
      const manipulator = widgetFactory.getManipulator();
      if (planeNormal.value !== null) manipulator.setNormal(planeNormal.value);
      if (planeOrigin.value !== null) manipulator.setOrigin(planeOrigin.value);
    });

    // visibility handling

    const { currentView } = useCurrentView();
    watchEffect(() => updateVisibility(context, currentView, currentLabelmap));
    onAddedToView(() =>
      updateVisibility(context, currentView, currentLabelmap)
    );

    // delete when not focused anymore

    onUnFocus(() => deleteSelf());

    // update paint handle direction

    setupHandleDirectionUpdater(widgetFactory);

    // radius updates

    const currentRadius = useComputedState(
      store,
      (state) => state.annotations.radius
    );
    watchEffect(() => {
      const radius = currentRadius.value;
      widgetFactory.setRadius(radius);
      if (paintFilter.value) {
        paintFilter.value.setRadius(radius);
      }
    });

    // update paint filter

    watchEffect(() =>
      configurePaintFilter(
        context,
        paintFilter,
        currentLabel,
        currentBaseImage,
        currentLabelmap
      )
    );

    // handle painting interactions

    setupInteractionHandler(context, paintFilter, currentLabelmap);

    // create or select labelmap if necessary

    store.dispatch(
      'annotations/createOrUseLastLabelmap',
      store.state.selectedBaseImage
    );

    return {
      factory: widgetFactory,
    };
  },
};
