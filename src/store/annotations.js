import Vue from 'vue';

import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';

import vtkLabelMap from '@/src/vtk/LabelMap';
import { LABEL_COLORMAP, LABEL_SWATCHES } from '@/src/constants';

export function defaultPalette() {
  return [{ label: 1, name: 'Label 1' }];
}

export function findNextLabelMapName(names) {
  const seen = [];
  const re = /^Labelmap (\d+)$/;
  names.forEach((name) => {
    const match = re.exec(name);
    if (match) {
      seen.push(Number(match[1]));
    }
  });
  seen.sort((a, b) => b - a);
  const nextNum = seen.length ? seen[0] + 1 : 1;
  return `Labelmap ${nextNum}`;
}

export function createLabelmapFromImage(imageData) {
  const labelmap = vtkLabelMap.newInstance(
    imageData.get('spacing', 'origin', 'direction')
  );
  labelmap.setDimensions(imageData.getDimensions());

  const values = new Uint8Array(imageData.getNumberOfPoints());
  const dataArray = vtkDataArray.newInstance({
    numberOfComponents: 1,
    values,
  });
  labelmap.getPointData().setScalars(dataArray);
  labelmap.computeTransforms();
  return labelmap;
}

export default () => ({
  namespaced: true,

  state: {
    currentLabelmapForImage: {}, // image ID -> labelmap ID
    // labelmap ID -> paint context
    // paint context: { palette, currentLabel }
    paintContexts: {},
    radius: 10,
    radiusRange: [1, 100],
  },

  mutations: {
    createPaintContext(state, labelmapId) {
      if (!(labelmapId in state.paintContexts)) {
        Vue.set(state.paintContexts, labelmapId, {
          palette: defaultPalette(),
          currentLabel: 1,
        });
      }
    },
    cloneColorMap(state, { labelmapID, colormap }) {
      Vue.set(state.labels, labelmapID, { ...colormap });
    },
    selectLabelmap(state, { imageId, labelmapId }) {
      Vue.set(state.currentLabelmapForImage, imageId, labelmapId);
    },
    selectLabel(state, { labelmapID, newLabel }) {
      // assumes that label exists
      const context = state.paintContexts[labelmapID];
      if (context) {
        context.currentLabel = newLabel;
      }
    },
    addLabel(state, { labelmapID, label, name }) {
      const context = state.paintContexts[labelmapID];
      if (context) {
        context.palette.push({
          label,
          name,
        });
      }
    },
    deleteLabelAtIndex(state, { labelmapID, index }) {
      const context = state.paintContexts[labelmapID];
      if (context) {
        context.palette.splice(index, 1);
      }
    },
    setRadius(state, radius) {
      state.radius = radius;
    },
    setRadiusRange(state, { min, max }) {
      state.radiusRange = [min, max];
    },
    setLabelValue(state, { labelmapID, index, value }) {
      if (labelmapID in state.paintContexts) {
        const context = state.paintContexts[labelmapID];
        if (index < context.palette.length) {
          const oldLabel = context.palette[index].label;
          context.palette[index].label = value;
          if (context.currentLabel === oldLabel) {
            context.currentLabel = value;
          }
        }
      }
    },
    removeLabelmap(state, labelmapID) {
      Vue.delete(state.labels, labelmapID);
    },
    removeData(state, dataId) {
      // dataId may be either a labelmap ID or image ID
      Vue.delete(state.currentLabelmapForImage, dataId);
      Vue.delete(state.paintContexts, dataId);
    },
  },

  actions: {
    async createOrUseLastLabelmap({ dispatch, state }, imageId) {
      if (!(imageId in state.currentLabelmapForImage)) {
        await dispatch('createLabelmap', imageId);
      }
    },
    async createLabelmap({ commit, dispatch, rootState }, imageId) {
      const { data } = rootState;
      if (imageId in data.vtkCache) {
        const imageData = data.vtkCache[imageId];

        const existingNames = data.labelmapIDs.map(
          (lid) => data.index[lid].name
        );
        const name = findNextLabelMapName(existingNames);

        // create labelmap from imageData
        const labelmap = createLabelmapFromImage(imageData);
        labelmap.setColorMap(LABEL_COLORMAP);

        const labelmapId = await dispatch(
          'importLabelMap',
          { name, labelMap: labelmap, parent: imageId },
          { root: true }
        );

        commit('selectLabelmap', {
          imageId,
          labelmapId,
        });

        /*
        commit('cloneColorMap', {
          labelmapID: id,
          colormap: DEFAULT_LABELMAP_COLORS,
        });
        */

        /* set default label to 1
        commit('selectLabel', {
          labelmapID: id,
          label: 1,
        });
        */
      }
    },
    createPaintContext({ commit, state }, labelmapId) {
      if (!(labelmapId in state.paintContexts)) {
        commit('createPaintContext', labelmapId);
      }
    },
    selectLabelmap({ commit, rootState }, labelmapID) {
      if (rootState.data.labelmapIDs.includes(labelmapID)) {
        const labelmap = rootState.data.vtkCache[labelmapID];
        const dims = labelmap.getDimensions();
        const spacing = labelmap.getSpacing();
        const avgDim = dims
          .map((d, i) => d * spacing[i])
          .reduce((avg, d) => avg + d / 3, 0);
        commit('setRadiusRange', {
          min: 1,
          max: Math.round(avgDim / 2),
        });
        commit('setRadius', Math.max(1, Math.round(avgDim / (5 * 2))));
        commit('selectLabelmap', labelmapID);
      }
    },

    setRadius({ commit }, radius) {
      commit('setRadius', radius);
    },

    setLabelName({ commit }, { labelmapId, index, name }) {
      commit('setLabelName', { labelmapId, index, name });
    },

    async setLabelValue({ state, commit, dispatch }, { labelmapID, index, value }) {
      const { palette } = state.paintContexts[labelmapID];
      if (index < palette.length) {
        const fromLabel = palette[index].label;
        await dispatch('relabelLabelmap', { labelmapID, fromLabel, toLabel: value });
        commit('setLabelValue', { labelmapID, index, value });
      }
    },

    async relabelLabelmap(
      { dispatch, rootState },
      { labelmapID, fromLabel, toLabel }
    ) {
      const image = rootState.data.vtkCache[labelmapID];
      if (image) {
        const voxels = image.getPointData().getScalars().getData();
        for (let i = 0; i < voxels.length; i++) {
          if (voxels[i] === fromLabel) {
            voxels[i] = toLabel;
          }
        }

        image.modified();
        await dispatch('visualization/redrawPipeline', labelmapID, {
          root: true,
        });
      }
    },

    setLabelColor({ commit, rootState }, { labelmapID, label, color }) {
      if (labelmapID in rootState.data.index) {
        commit('setLabelColor', { labelmapID, label, color });
        const labelmap = rootState.data.vtkCache[labelmapID];
        labelmap.setLabelColor(label, color);
      }
    },

    selectLabel({ commit }, { labelmapID, newLabel }) {
      commit('selectLabel', { labelmapID, newLabel });
    },

    async deleteLabel({ state, dispatch, commit }, { labelmapID, label }) {
      const context = state.paintContexts[labelmapID];
      if (context) {
        const index = context.palette.findIndex((item) => item.label === label);
        if (index > -1) {
          commit('deleteLabelAtIndex', { labelmapID, index });
          if (context.currentLabel === label) {
            const nextPaletteItem = context.palette[index] || context.palette[index - 1];
            if (nextPaletteItem) {
              commit('selectLabel', { labelmapID, newLabel: nextPaletteItem.label });
            } else {
              commit('selectLabel', { labelmapID, newLabel: 0 });
            }
          }
          // clear labelled pixels to 0
          await dispatch('relabelLabelmap', { labelmapID, fromLabel: label, toLabel: 0 });
        }
      }
    },

    createLabel({ state, commit }, labelmapID) {
      const context = state.paintContexts[labelmapID];
      if (context && context.palette.length < LABEL_SWATCHES.length) {
        const labels = new Set(context.palette.map((p) => p.label));
        // find unused label
        for (let i = 1; i <= LABEL_SWATCHES.length; i++) {
          if (!labels.has(i)) {
            commit('addLabel', { labelmapID, label: i, name: 'Label' });
            return i;
          }
        }
      }
      return -1;
    },

    removeData({ commit }, dataID) {
      commit('removeData', dataID);
    },
  },
});
