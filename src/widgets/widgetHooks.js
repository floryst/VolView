import { vec3 } from 'gl-matrix';
import { onAddedToView, onDeleted, onViewMouseEvent } from './context';
import { observe, ref, computed } from './reactivity';

const INVALID = -1;

export function is2DView(view) {
  return !!view?.getAxis;
}

export function renderViewAndWidgets(view) {
  view.getReferenceByName('widgetManager').renderWidgets();
  view.getRenderWindow().render();
}

export function watchStore(store, getter, fn, opts) {
  const stop = store.watch(getter, fn, opts);
  onDeleted(stop);
}

/**
 * NOTE: This is inconsistent usage compared to the one in
 * composables/store.js. This one doesn't support multiple
 * computed values. Also, this depends on the widget lifecycle.
 */
export function useComputedState(store, getter) {
  const state = ref(getter(store.state, store.getters));
  watchStore(store, getter, (val) => {
    state.value = val;
  });
  return state;
}

export function useCurrentView() {
  const currentView = ref(null);
  const currentViewType = ref(null);

  onViewMouseEvent(({ type, view, viewType }) => {
    if (type === 'mouseenter' || type === 'mousemove') {
      currentView.value = view;
      currentViewType.value = viewType;
    } else if (type === 'mouseleave') {
      currentView.value = null;
      currentViewType.value = null;
    }
  });

  return { currentView, currentViewType };
}

export function useCurrentSlice(store) {
  const { currentView } = useCurrentView();

  const slices = useComputedState(store, (state) => state.visualization.slices);

  const inSliceView = computed(() => is2DView(currentView.value));
  const currentAxis = computed(() =>
    inSliceView.value ? currentView.value.getAxis() : null
  );
  const currentSlice = computed(() => {
    if (currentAxis.value !== null) {
      return slices.value['xyz'[currentAxis.value]];
    }
    return null;
  });

  return {
    inSliceView,
    currentAxis,
    currentSlice,
  };
}

export function usePlaneManipulator(store) {
  const { currentAxis, currentSlice } = useCurrentSlice(store);

  const plane = computed(() => {
    const currentAxisVal = currentAxis.value;
    const currentSliceVal = currentSlice.value;

    // expects IJK slicing
    if (currentAxisVal !== null && currentSliceVal !== null) {
      const { imageParams } = store.state.visualization;

      const normal = [0, 0, 0];
      const origin = [0, 0, 0];
      normal[currentAxisVal] = 1;
      origin[currentAxisVal] = currentSliceVal;

      vec3.transformMat3(normal, normal, imageParams.direction);
      vec3.transformMat4(origin, origin, imageParams.indexToWorld);
      return { normal, origin };
    }
    return null;
  });

  const planeNormal = computed(() => plane.value?.normal || null);
  const planeOrigin = computed(() => plane.value?.origin || null);

  return { planeNormal, planeOrigin };
}

export function useSliceFollower(
  store,
  lockAxis,
  lockSlice,
  widgetFactory,
  viewTypeMap,
  widgetInstances
) {
  const { currentView } = useCurrentView();

  const slices = ref(store.state.visualization.slices);
  const currentAxis = computed(() => {
    if (is2DView(currentView.value)) {
      return currentView.value.getAxis();
    }
    return INVALID;
  });
  const currentSlice = computed(() => {
    if (currentAxis.value !== INVALID) {
      return slices.value['xyz'[currentAxis.value]];
    }
    return INVALID;
  });

  watchStore(
    store,
    (state) => state.visualization.slices,
    (newSlices) => {
      slices.value = newSlices;
    }
  );

  function updateManipulator() {
    if (is2DView(currentView.value)) {
      const { imageParams } = store.state.visualization;

      const vaxis = lockAxis.value ?? currentView.value.getAxis();
      const vslice = lockSlice.value ?? slices.value['xyz'[vaxis]];

      const normal = [0, 0, 0];
      const origin = [0, 0, 0];
      normal[vaxis] = 1;
      origin[vaxis] = vslice;

      vec3.transformMat3(normal, normal, imageParams.direction);
      vec3.transformMat4(origin, origin, imageParams.indexToWorld);

      // plane manipulator
      const manipulator = widgetFactory.getManipulator();
      manipulator.setNormal(normal);
      manipulator.setOrigin(origin);
    }
  }

  /**
   * If view is not null, then hide widget in views that don't
   * match the correct view type.
   * If view is null, then hide all widgets.
   *
   * TODO if on diff dataset, then hide.
   */
  function updateVisibility() {
    const views = Array.from(widgetInstances.keys());
    views.forEach((otherView) => {
      let visible = false;
      if (widgetInstances.has(otherView)) {
        // handle views of the same type

        // case: not locked to a slice/axis
        if (lockAxis.value === null || lockSlice.value === null) {
          if (currentView.value && viewTypeMap.has(currentView.value)) {
            const viewType = viewTypeMap.get(currentView.value);
            visible = viewTypeMap.get(otherView) === viewType;
          } else {
            visible = false;
          }
        }

        // case: locked to a slice/axis
        if (lockAxis.value !== null && lockSlice.value !== null) {
          if (is2DView(otherView)) {
            const otherAxis = otherView.getAxis();
            visible =
              otherAxis === lockAxis.value &&
              Math.abs(slices.value['xyz'[otherAxis]] - lockSlice.value) < 1e-6;
          } else {
            visible = false;
          }
        }

        const viewWidget = widgetInstances.get(otherView);
        viewWidget.setVisibility(visible);
        viewWidget.setContextVisibility(visible);
        renderViewAndWidgets(otherView);
      }
    });
  }

  updateManipulator();
  updateVisibility();

  onAddedToView(() => updateVisibility());

  observe([currentAxis, currentSlice], updateManipulator);

  observe([currentView, slices], updateVisibility);

  observe([lockAxis, lockSlice], ([laxis, lslice]) => {
    if (laxis === null && lslice === null) {
      updateManipulator();
    }
  });

  return { axis: currentAxis, slice: currentSlice };
}
