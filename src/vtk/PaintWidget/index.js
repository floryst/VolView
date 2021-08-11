import macro from 'vtk.js/Sources/macro';
import vtkPaintWidget from 'vtk.js/Sources/Widgets/Widgets3D/PaintWidget';

function widgetBehavior(publicAPI, model) {
  model.classHierarchy.push('vtk2DPaintWidgetProp');

  let manipulatorListener = null;

  publicAPI.handleStartMouseWheel = (e) => {
    if (model.activeState && model.activeState.getActive() && model.pickable) {
      if (manipulatorListener) {
        manipulatorListener.unsubscribe();
      }
      console.log(e);
      manipulatorListener = model.manipulator.onModified(() =>
        publicAPI.handleEvent(e)
      );
    }
  };

  publicAPI.handleEndMouseWheel = () => {
    if (manipulatorListener) {
      manipulatorListener.unsubscribe();
      manipulatorListener = null;
    }
  };
}

function vtk2DPaintWidget(publicAPI, model) {
  model.classHierarchy.push('vtk2DPaintWidget');

  model.behavior = macro.chain(model.behavior, widgetBehavior);
}

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, initialValues);

  vtkPaintWidget.extend(publicAPI, model, initialValues);

  vtk2DPaintWidget(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend, 'vtk2DPaintWidget');

// ----------------------------------------------------------------------------

export default { newInstance, extend };
