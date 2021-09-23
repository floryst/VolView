import Vue from 'vue';
import vtkITKHelper from '@kitware/vtk.js/Common/DataModel/ITKHelper';

import { pick } from '@/src/utils/common';

export const ANONYMOUS_PATIENT = 'Anonymous';
export const ANONYMOUS_PATIENT_ID = 'ANONYMOUS';

export function imageCacheMultiKey(offset, asThumbnail) {
  return `${offset}!!${asThumbnail}`;
}

/**
 * Generate a synthetic multi-key patient key from a Patient object.
 *
 * This key is used to try to uniquely identify a patient, since the PatientID
 * is not guaranteed to be unique (especially in the anonymous case).
 *
 * Required keys in the Patient object:
 * - PatientName
 * - PatientID
 * - PatientBirthDate
 * - PatientSex
 *
 * @param {Patient} patient
 */
export function genSynPatientKey(patient) {
  const pid = patient.PatientID.trim();
  const name = patient.PatientName.trim();
  const bdate = patient.PatientBirthDate.trim();
  const sex = patient.PatientSex.trim();
  // we only care about making a unique key here. The
  // data doesn't actually matter.
  return [pid, name, bdate, sex].map((s) => s.replace('|', '_')).join('|');
}

// patientKey is generated from genSynPatientKey
// studyKey is the StudyInstanceUID
// volumeKey is the volume ID generated by dicom.cpp
export const initialState = () => ({
  patientIndex: {}, // patientKey -> Patient
  patientStudies: {}, // patientKey -> [studyKey]

  studyIndex: {}, // studyKey -> Study
  studyVolumes: {}, // studyKey -> [volumeKey]

  volumeIndex: {}, // volumeKey -> VolumeInfo

  // help derive keys of parent objects in the hierarchy
  volumeParent: {}, // volumeKey -> { studyKey }
  studyParent: {}, // studyKey -> { patientKey }

  // TODO move caches out of state to avoid making entire objects reactive
  // image slice cache
  imageCache: {}, // volumeKey -> { imageCacheMultiKey: ITKImage }
  // volume cache
  volumeCache: {}, // volumeKey -> ItkImage or vtk image?
});

export const mutations = {
  addPatient(state, { patientKey, patient }) {
    if (!(patientKey in state.patientIndex)) {
      Vue.set(state.patientIndex, patientKey, patient);
    }
  },

  addStudy(state, { studyKey, study, patientKey }) {
    if (!(studyKey in state.studyIndex)) {
      Vue.set(state.studyIndex, studyKey, study);
      Vue.set(state.studyParent, studyKey, patientKey);
      Vue.set(state.studyIndex, studyKey, study);
      state.patientStudies[patientKey] = state.patientStudies[patientKey] ?? [];
      state.patientStudies[patientKey].push(studyKey);
    }
  },

  addVolume(state, { volumeKey, volumeInfo, studyKey }) {
    if (!(volumeKey in state.volumeIndex)) {
      Vue.set(state.volumeIndex, volumeKey, volumeInfo);
      Vue.set(state.volumeParent, volumeKey, studyKey);
      state.studyVolumes[studyKey] = state.studyVolumes[studyKey] ?? [];
      state.studyVolumes[studyKey].push(volumeKey);
    }
  },

  removeVolume(state, volumeKey) {
    if (volumeKey in state.volumeIndex) {
      const studyKey = state.volumeParent[volumeKey];
      const idx = state.studyVolume[studyKey].indexOf(volumeKey);
      if (idx > -1) {
        state.studyVolumes[studyKey].splice(idx, 1);
        Vue.delete(state.volumeParent, volumeKey);
        Vue.delete(state.volumeIndex, volumeKey);
      }
    }
  },

  cacheImageSlice(state, { volumeKey, offset, asThumbnail, image }) {
    const key = imageCacheMultiKey(offset, asThumbnail);
    state.imageCache = {
      ...state.imageCache,
      [volumeKey]: {
        ...(state.imageCache[volumeKey] || {}),
        [key]: image,
      },
    };
  },

  cacheVolume(state, { volumeKey, image }) {
    Vue.set(state.volumeCache, volumeKey, image);
  },

  deleteVolume(state, volumeKey) {
    Vue.delete(state.volumeCache, volumeKey);
  },
};

export const createActions = (dicomIO) => ({
  async importFiles({ state, commit }, files) {
    if (files.length === 0) {
      return [];
    }

    const updatedVolumes = await dicomIO.importFiles(files);
    const updatedVolumeKeys = []; // to be returned to caller

    await Promise.all(
      updatedVolumes.map(async (volumeKey) => {
        const numberOfSlices = await dicomIO.buildVolumeList(volumeKey);

        if (!(volumeKey in state.volumeIndex)) {
          const info = await dicomIO.readTags(volumeKey, [
            { name: 'PatientName', tag: '0010|0010', strconv: true },
            { name: 'PatientID', tag: '0010|0020', strconv: true },
            { name: 'PatientBirthDate', tag: '0010|0030' },
            { name: 'PatientSex', tag: '0010|0040' },
            { name: 'StudyInstanceUID', tag: '0020|000d' },
            { name: 'StudyDate', tag: '0008|0020' },
            { name: 'StudyTime', tag: '0008|0030' },
            { name: 'StudyID', tag: '0020|0010', strconv: true },
            { name: 'AccessionNumber', tag: '0008|0050' },
            { name: 'StudyDescription', tag: '0008|1030', strconv: true },
            { name: 'Modality', tag: '0008|0060' },
            { name: 'SeriesInstanceUID', tag: '0020|000e' },
            { name: 'SeriesNumber', tag: '0020|0011' },
            { name: 'SeriesDescription', tag: '0008|103e', strconv: true },
          ]);

          // TODO parse the raw string values
          const patient = {
            PatientID: info.PatientID || ANONYMOUS_PATIENT_ID,
            PatientName: info.PatientName || ANONYMOUS_PATIENT,
            PatientBirthDate: info.PatientBirthDate || '',
            PatientSex: info.PatientSex || '',
          };
          const patientKey = genSynPatientKey(patient);

          const studyKey = info.StudyInstanceUID;
          const study = pick(info, [
            'StudyID',
            'StudyInstanceUID',
            'StudyDate',
            'StudyTime',
            'AccessionNumber',
            'StudyDescription',
          ]);

          const volumeInfo = {
            ...pick(info, [
              'Modality',
              'SeriesInstanceUID',
              'SeriesNumber',
              'SeriesDescription',
            ]),
            NumberOfSlices: numberOfSlices,
            VolumeID: volumeKey,
          };

          updatedVolumeKeys.push({
            patientKey,
            studyKey,
            volumeKey,
          });

          commit('addPatient', { patientKey, patient });
          commit('addStudy', { studyKey, study, patientKey });
          commit('addVolume', { volumeKey, volumeInfo, studyKey });
        }

        // invalidate existing volume
        if (volumeKey in state.volumeCache) {
          commit('deleteVolumeImage', volumeKey);
        }
      })
    );
    return updatedVolumeKeys;
  },

  /**
   * Returns an ITK image for a single slice.
   *
   * volumeID: the target volume
   * slice: the slice offset to retrieve
   * asThumbnail: whether to cast image to unsigned char. Defaults to false.
   */
  async getVolumeSlice(
    { commit, state },
    { volumeID, slice, asThumbnail = false }
  ) {
    const cacheKey = imageCacheMultiKey(slice, asThumbnail);
    if (
      volumeID in state.imageCache &&
      cacheKey in state.imageCache[volumeID]
    ) {
      return state.imageCache[volumeID][cacheKey];
    }

    if (!(volumeID in state.volumeIndex)) {
      throw new Error(`Cannot find given volume key: ${volumeID}`);
    }
    const volumeInfo = state.volumeIndex[volumeID];
    const numSlices = volumeInfo.NumberOfSlices;

    if (slice < 1 || slice > numSlices) {
      throw new Error(`Slice ${slice} is out of bounds`);
    }

    const itkImage = dicomIO.getVolumeSlice(volumeID, slice, asThumbnail);

    commit('cacheImageSlice', {
      volumeKey: volumeID,
      offset: slice,
      asThumbnail,
      image: itkImage,
    });

    return itkImage;
  },

  /**
   * Builds a volume and returns it as a VTK image.
   *
   * Volumes may be invalidated if new files are imported
   * into the volume.
   */
  async buildVolume({ state, commit }, volumeID) {
    if (volumeID in state.volumeCache) {
      return state.volumeCache[volumeID];
    }

    if (!(volumeID in state.volumeIndex)) {
      throw new Error(`Cannot find given volume key: ${volumeID}`);
    }

    const itkImage = await dicomIO.buildVolume(volumeID);

    const vtkImage = vtkITKHelper.convertItkToVtkImage(itkImage);

    commit('cacheVolume', {
      volumeKey: volumeID,
      image: vtkImage,
    });

    return vtkImage;
  },

  async removeData({ commit }, volumeID) {
    await dicomIO.deleteVolume(volumeID);
    commit('deleteVolume', volumeID);
    commit('removeVolume', volumeID);
  },
});

export const createModule = (dicomIO) => ({
  namespaced: true,
  state: initialState(),
  mutations,
  actions: createActions(dicomIO),
});
