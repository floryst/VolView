import Vue from 'vue';
import Vuex from 'vuex';

import { Modules, DataTypes } from '../constants';

// import dicom from './dicom';
// import visualization from './visualization';
// import widgets from './widgets';
// import annotations from './annotations';
// import measurements from './measurements';

// import * as datasets from './datasets';

export function createIDGen() {
  let id = 0;

  return {
    reset() {
      id = 0;
    },
    next() {
      return id++;
    },
  };
}

export const GenID = createIDGen();

export const initialState = () => ({
  // Maps data ID to the data type
  dataTypeByID: {},

  // data: {
  //   nextID: 1,
  //   index: {},
  //   imageIDs: [],
  //   dicomIDs: [],
  //   modelIDs: [],
  //   labelmapIDs: [],
  //   vtkCache: {},
  // },

  // // track the mapping from volumeID to data ID
  // dicomVolumeToDataID: {},
  // selectedBaseImage: NO_SELECTION,

  // // data-data associations, in parent-of or child-of relationships.
  // // is used for cascaded deletes
  // dataAssoc: {
  //   childrenOf: {},
  //   parentOf: {},
  // },
});

export const getters = {};

export const mutations = {
  mapIDToType(state, { id, type }) {
    Vue.set(state.dataTypeByID, id, type);
  },
  removeIDToType(state, id) {
    Vue.delete(state.dataTypeByID, id);
  },
};

export const createActions = () => ({
  /**
   * Adds a VTK dataset of a given type.
   */
  async addDataset({ commit, dispatch }, { type, dataset }) {
    const id = GenID.next();
    switch (type) {
      case DataTypes.Image:
        await dispatch(`${Modules.Image}/addImage`, { id, image: dataset });
        break;
      // case DataTypes.Labelmap:
      //   await dispatch(`${LabelmapModule}/addLabelmap`, { id, dataset });
      //   break;
      // case DataTypes.Model:
      //   await dispatch(`${ModelModule}/addModel`, { id, dataset });
      //   break;
      default:
        throw Error(`[addDataset] Invalid type ${type}`);
    }
    commit('mapIDToType', { id, type });
    return id;
  },

  /**
   * Removes a dataset given an ID.
   */
  removeDataset({ state, commit }, id) {
    if (!(id in state.dataTypeByID)) {
      throw Error('[removeDataset] ID is not valid');
    }

    const type = state.dataTypeByID[id];
    commit('removeIDToType', id);

    switch (type) {
      case DataTypes.Image:
        // await dispatch(`${ImageModule}/removeImage`, id);
        break;
      // case DataTypes.Labelmap:
      //   // await dispatch(`${LabelmapModule}/removeLabelmap`, id);
      //   break;
      // case DataTypes.Model:
      //   // await dispatch(`${ModelModule}/removeModel`, id);
      //   break;
      default: // noop
    }

    // await dispatch(`${VizModule}/removeDataset`, id);
  },

  importFiles({ dispatch }, fileList) {
    // should split fileList into regular files and DICOM files
    // send DICOM files to dicom module
    // const [singleFiles, dicomFiles] = await partitionDICOM(fileList);

    const importDICOM = async (files) => {
      const updatedVolumeKeys = await dispatch('dicom/importFiles', files);
    };

    const promises = [];
    promises.push((async () => {})());
  },
});

export default () =>
  new Vuex.Store({
    modules: {},
    state: initialState(),
    getters,
    mutations,
    actions: createActions(),
    //   visiblelabelmaps(state) {
    //     return state.data.labelmapIDs.filter(
    //       (id) => state.dataAssoc.parentOf[id] === state.selectedBaseImage
    //     );
    //   },
    //   sceneObjectIDs(state, getters) {
    //     const { selectedBaseImage, data } = state;
    //     const order = [].concat(getters.visibleLabelmaps, data.modelIDs);
    //     if (selectedBaseImage !== NO_SELECTION) {
    //       order.unshift(selectedBaseImage);
    //     }
    //     return order;
    //   },
    // },
  });
