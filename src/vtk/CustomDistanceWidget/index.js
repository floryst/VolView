import macro from '@kitware/vtk.js/macro';
import vtkDistanceWidget from '@kitware/vtk.js/Widgets/Widgets3D/DistanceWidget';
import vtkSphereHandleRepresentation from '@kitware/vtk.js/Widgets/Representations/SphereHandleRepresentation';
import vtkPolyLineRepresentation from '@kitware/vtk.js/Widgets/Representations/PolyLineRepresentation';
import { ViewTypes } from '@kitware/vtk.js/Widgets/Core/WidgetManager/Constants';

import stateGenerator from './state';

function vtkCustomDistanceWidget(publicAPI, model) {
  model.classHierarchy.push('vtkCustomDistanceWidget');

  model.widgetState = stateGenerator();

  // override
  // eslint-disable-next-line no-param-reassign
  publicAPI.getRepresentationsForViewType = (viewType) => {
    switch (viewType) {
      case ViewTypes.GEOMETRY:
      case ViewTypes.SLICE:
      case ViewTypes.VOLUME:
      case ViewTypes.DEFAULT:
      default:
        return [
          {
            builder: vtkSphereHandleRepresentation,
            labels: ['handles'],
            initialValues: { scaleInPixels: true },
          },
          {
            builder: vtkSphereHandleRepresentation,
            labels: ['moveHandle'],
            initialValues: { scaleInPixels: true },
          },
          {
            builder: vtkPolyLineRepresentation,
            labels: ['handles', 'moveHandle'],
          },
        ];
    }
  };
}

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, initialValues);

  vtkDistanceWidget.extend(publicAPI, model, initialValues);

  vtkCustomDistanceWidget(publicAPI, model);
}

export const newInstance = macro.newInstance(extend, 'vtkCustomDistanceWidget');

export default { newInstance, extend };
