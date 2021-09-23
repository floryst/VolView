export const initialState = () => ({
    /**
     * Image:
     *   dims: number[3]
     *   spacing: number[3]
     *   origin: number[3]
     *   orientation: number[9]
     *   worldToIndex: number[16]
     *   indexToWorld: number[16]
     */
    byID: {}, // ID -> Image
    vtkCache: {}, // ID -> vtkImageData
});

export const mutations = {};

export const createActions = () => ({
    addImage({ commit }, { id, image }) {
        if (image?.isA?.('vtkImageData')) {
            commit('addImage', { id, image });
        } else {
            throw Error('Did not receive vtkImageData');
        }
    }
});

export default () => ({
    namespaced: true,
    state: initialState(),
    mutations,
    actions: createActions(),
})