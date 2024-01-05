import vtkITKHelper from '@kitware/vtk.js/Common/DataModel/ITKHelper';
import { defineStore } from 'pinia';
import { Image, readImageBlob } from 'itk-wasm';
import { FileDataSource } from '@/src/io/import/dataSource';
import { Chunk } from '@/src/core/streaming/chunk';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import { NAME_TO_TAG } from '@/src/core/dicomTags';
import { TypedArray, Vector3 } from '@kitware/vtk.js/types';
import { Maybe } from '@/src/types';
import { mat3, vec3 } from 'gl-matrix';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import { pick, removeFromArray } from '../utils';
import { useImageStore } from './datasets-images';
import { useFileStore } from './datasets-files';
import { StateFile, DatasetType } from '../io/state-file/schema';
import { serializeData } from '../io/state-file/utils';
import {
  buildImage,
  readTags,
  readVolumeSlice,
  splitAndSort,
} from '@/src/io/dicom';
import { getWorker } from '@/src/io/itk/worker';

export const ANONYMOUS_PATIENT = 'Anonymous';
export const ANONYMOUS_PATIENT_ID = 'ANONYMOUS';

export function imageCacheMultiKey(offset: number, asThumbnail: boolean) {
  return `${offset}!!${asThumbnail}`;
}

export interface VolumeKeys {
  patientKey: string;
  studyKey: string;
  volumeKey: string;
}

export interface PatientInfo {
  PatientID: string;
  PatientName: string;
  PatientBirthDate: string;
  PatientSex: string;
}

export interface StudyInfo {
  StudyID: string;
  StudyInstanceUID: string;
  StudyDate: string;
  StudyTime: string;
  AccessionNumber: string;
  StudyDescription: string;
}

export interface VolumeInfo {
  NumberOfSlices: number;
  VolumeID: string;
  Modality: string;
  SeriesInstanceUID: string;
  SeriesNumber: string;
  SeriesDescription: string;
  WindowLevel: string;
  WindowWidth: string;
}

interface State {
  // volumeKey -> imageCacheMultiKey -> ITKImage
  sliceData: Record<string, Record<string, Image>>;

  // volumeKey -> imageID
  volumeToImageID: Record<string, string | undefined>;
  // imageID -> volumeKey
  imageIDToVolumeKey: Record<string, string>;

  // volume invalidation information
  needsRebuild: Record<string, boolean>;

  // patientKey -> patient info
  patientInfo: Record<string, PatientInfo>;
  // patientKey -> array of studyKeys
  patientStudies: Record<string, string[]>;

  // studyKey -> study info
  studyInfo: Record<string, StudyInfo>;
  // studyKey -> array of volumeKeys
  studyVolumes: Record<string, string[]>;

  // volumeKey -> volume info
  volumeInfo: Record<string, VolumeInfo>;

  // parent pointers
  // volumeKey -> studyKey
  volumeStudy: Record<string, string>;
  // studyKey -> patientKey
  studyPatient: Record<string, string>;

  volumeChunks: Record<string, Chunk[]>;
}

const readDicomTags = (file: File) =>
  readTags(file, [
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
    { name: 'WindowLevel', tag: '0028|1050' },
    { name: 'WindowWidth', tag: '0028|1051' },
  ]);

/**
 * Trims and collapses multiple spaces into one.
 * @param name
 * @returns string
 */
const cleanupName = (name: string) => {
  return name.trim().replace(/\s+/g, ' ');
};

export const getDisplayName = (info: VolumeInfo) => {
  return (
    cleanupName(info.SeriesDescription || info.SeriesNumber) ||
    info.SeriesInstanceUID
  );
};

function toVec(s: Maybe<string>): number[] | null {
  if (!s?.length) return null;
  return s.split('\\').map((a) => Number(a)) as number[];
}

function getTypedArrayConstructor(
  bitsAllocated: number,
  pixelRepresentation: number
) {
  if (bitsAllocated % 8 !== 0)
    throw new Error('bits allocated is not a multiple of 8!');
  if (bitsAllocated === 0) throw new Error('bits allocated is zero!');

  switch (bitsAllocated) {
    case 8:
      return pixelRepresentation ? Int8Array : Uint8Array;
    case 16:
      return pixelRepresentation ? Int16Array : Uint16Array;
    case 32:
      return pixelRepresentation ? Int32Array : Uint32Array;
    default:
      throw new Error(
        `Cannot interpret combo of bits allocated and pixel representation: ${bitsAllocated}, ${pixelRepresentation}`
      );
  }
}

const ImagePositionPatientTag = NAME_TO_TAG.get('ImagePositionPatient')!;
const ImageOrientationPatientTag = NAME_TO_TAG.get('ImageOrientationPatient')!;
const PixelSpacingTag = NAME_TO_TAG.get('PixelSpacing')!;
const RowsTag = NAME_TO_TAG.get('Rows')!;
const ColumnsTag = NAME_TO_TAG.get('Columns')!;
const BitsAllocatedTag = NAME_TO_TAG.get('BitsAllocated')!;
const PixelRepresentationTag = NAME_TO_TAG.get('PixelRepresentation')!;
const SamplesPerPixelTag = NAME_TO_TAG.get('SamplesPerPixel')!;

function allocateImageFromChunks(sortedChunks: Chunk[]) {
  if (sortedChunks.length === 0) {
    throw new Error('Cannot allocate an image from zero chunks');
  }

  // use the first chunk as the source of metadata
  const meta = new Map(sortedChunks[0].metadata!);
  const imagePositionPatient = toVec(meta.get(ImagePositionPatientTag));
  const imageOrientationPatient = toVec(meta.get(ImageOrientationPatientTag));
  const pixelSpacing = toVec(meta.get(PixelSpacingTag));
  const rows = Number(meta.get(RowsTag) ?? 0);
  const columns = Number(meta.get(ColumnsTag) ?? 0);
  const bitsAllocated = Number(meta.get(BitsAllocatedTag) ?? 0);
  const pixelRepresentation = Number(meta.get(PixelRepresentationTag));
  const samplesPerPixel = Number(meta.get(SamplesPerPixelTag) ?? 1);

  const slices = sortedChunks.length;
  const TypedArrayCtor = getTypedArrayConstructor(
    bitsAllocated,
    pixelRepresentation
  );
  const pixelData = new TypedArrayCtor(rows * columns * slices);

  const image = vtkImageData.newInstance();
  image.setExtent([0, columns - 1, 0, rows - 1, 0, slices - 1]);

  if (imagePositionPatient) {
    image.setOrigin(imagePositionPatient as Vector3);
  }

  image.setSpacing([1, 1, 1]);
  if (slices > 1 && imagePositionPatient && pixelSpacing) {
    const secondMeta = new Map(sortedChunks[1].metadata);
    const secondIPP = toVec(secondMeta.get(ImagePositionPatientTag));
    if (secondIPP) {
      const spacing = [...pixelSpacing, 1];
      // assumption: uniform Z spacing
      const zVec = vec3.create();
      const firstIPP = imagePositionPatient;
      vec3.sub(zVec, secondIPP as vec3, firstIPP as vec3);
      spacing[2] = vec3.len(zVec) || 1;
      image.setSpacing(spacing);
    }
  }

  if (imageOrientationPatient) {
    const zDir = vec3.create() as Vector3;
    vec3.cross(
      zDir,
      imageOrientationPatient.slice(0, 3) as vec3,
      imageOrientationPatient.slice(3, 6) as vec3
    );
    image.setDirection([...imageOrientationPatient, ...zDir] as mat3);
  }

  const dataArray = vtkDataArray.newInstance({
    numberOfComponents: samplesPerPixel,
    values: pixelData,
  });
  image.getPointData().setScalars(dataArray);

  return image;
}

export const useDICOMStore = defineStore('dicom', {
  state: (): State => ({
    sliceData: {},
    volumeToImageID: {},
    imageIDToVolumeKey: {},
    patientInfo: {},
    patientStudies: {},
    studyInfo: {},
    studyVolumes: {},
    volumeInfo: {},
    volumeStudy: {},
    studyPatient: {},
    needsRebuild: {},

    volumeChunks: Object.create(null),
  }),
  actions: {
    async importChunks(chunks: Chunk[]) {
      if (chunks.length === 0) return [];

      const newChunks = chunks.filter(() => {
        // identify duplicate chunk via SOPInstanceUID
        return true;
      });
      const volumeChunks = await splitAndSort(
        newChunks,
        (chunk) => chunk.metaBlob!
      );

      Object.entries(volumeChunks).forEach(([volumeId, chks]) => {
        this._addVolumeChunks(volumeId, chks);
      });

      return Object.keys(volumeChunks);
    },
    _addVolumeChunks(imageId: string, chunks: Chunk[]) {
      // TODO if volumeId exists, call splitAndSort on all chunks
      this.volumeChunks[imageId] = chunks;
      const image = allocateImageFromChunks(chunks);
      const imageStore = useImageStore();
      if (imageId in imageStore.dataIndex) {
        imageStore.updateData(imageId, image);
      } else {
        imageStore.addVTKImageData('asdfasdf', image, imageId);
      }

      // TODO better update mechanism
      const scalars = image.getPointData().getScalars();
      scalars.setRange({ min: 0, max: 255 }, 0);
      const pixelData = scalars.getData() as TypedArray;
      const dims = image.getDimensions();
      chunks.forEach(async (chunk, index) => {
        await chunk.loadData();
        const result = await readImageBlob(
          getWorker(),
          chunk.data!,
          'file.dcm'
        );
        const offset = dims[0] * dims[1] * index;
        pixelData.set(result.image.data! as TypedArray, offset);
        image.modified();
      });
    },
    async importFiles(datasets: FileDataSource[]) {
      if (!datasets.length) return [];

      const fileToDataSource = new Map(
        datasets.map((ds) => [ds.fileSrc.file, ds])
      );
      const allFiles = [...fileToDataSource.keys()];

      const volumeToFiles = await splitAndSort(allFiles);
      if (Object.keys(volumeToFiles).length === 0)
        throw new Error('No volumes categorized from DICOM file(s)');

      const fileStore = useFileStore();

      // Link VolumeKey and DatasetFiles in fileStore
      Object.entries(volumeToFiles).forEach(([volumeKey, files]) => {
        const volumeDatasetFiles = files.map((file) => {
          const source = fileToDataSource.get(file);
          if (!source)
            throw new Error('Did not match File with source DataSource');
          return source;
        });
        fileStore.add(volumeKey, volumeDatasetFiles);
      });

      await Promise.all(
        Object.entries(volumeToFiles).map(async ([volumeKey, files]) => {
          // Read tags of first file
          if (!(volumeKey in this.volumeInfo)) {
            const tags = await readDicomTags(files[0]);
            // TODO parse the raw string values
            const patient = {
              PatientID: tags.PatientID || ANONYMOUS_PATIENT_ID,
              PatientName: tags.PatientName || ANONYMOUS_PATIENT,
              PatientBirthDate: tags.PatientBirthDate || '',
              PatientSex: tags.PatientSex || '',
            };

            const study = pick(
              tags,
              'StudyID',
              'StudyInstanceUID',
              'StudyDate',
              'StudyTime',
              'AccessionNumber',
              'StudyDescription'
            );

            const volumeInfo = {
              ...pick(
                tags,
                'Modality',
                'SeriesInstanceUID',
                'SeriesNumber',
                'SeriesDescription',
                'WindowLevel',
                'WindowWidth'
              ),
              NumberOfSlices: files.length,
              VolumeID: volumeKey,
            };

            this._updateDatabase(patient, study, volumeInfo);
          }

          // invalidate any existing volume
          if (volumeKey in this.volumeToImageID) {
            // buildVolume requestor uses this as a rebuild hint
            this.needsRebuild[volumeKey] = true;
          }
        })
      );

      return Object.keys(volumeToFiles);
    },

    _updateDatabase(
      patient: PatientInfo,
      study: StudyInfo,
      volume: VolumeInfo
    ) {
      const patientKey = patient.PatientID;
      const studyKey = study.StudyInstanceUID;
      const volumeKey = volume.VolumeID;

      if (!(patientKey in this.patientInfo)) {
        this.patientInfo[patientKey] = patient;
        this.patientStudies[patientKey] = [];
      }

      if (!(studyKey in this.studyInfo)) {
        this.studyInfo[studyKey] = study;
        this.studyVolumes[studyKey] = [];
        this.studyPatient[studyKey] = patientKey;
        this.patientStudies[patientKey].push(studyKey);
      }

      if (!(volumeKey in this.volumeInfo)) {
        this.volumeInfo[volumeKey] = volume;
        this.volumeStudy[volumeKey] = studyKey;
        this.sliceData[volumeKey] = {};
        this.studyVolumes[studyKey].push(volumeKey);
      }
    },

    deleteVolume(volumeKey: string) {
      const imageStore = useImageStore();
      if (volumeKey in this.volumeInfo) {
        const studyKey = this.volumeStudy[volumeKey];
        delete this.volumeInfo[volumeKey];
        delete this.sliceData[volumeKey];
        delete this.volumeStudy[volumeKey];

        if (volumeKey in this.volumeToImageID) {
          const imageID = this.volumeToImageID[volumeKey]!;
          imageStore.deleteData(imageID!);
          delete this.volumeToImageID[volumeKey];
          delete this.imageIDToVolumeKey[imageID];
        }

        removeFromArray(this.studyVolumes[studyKey], volumeKey);
        if (this.studyVolumes[studyKey].length === 0) {
          this.deleteStudy(studyKey);
        }
      }
    },

    deleteStudy(studyKey: string) {
      if (studyKey in this.studyInfo) {
        const patientKey = this.studyPatient[studyKey];
        delete this.studyInfo[studyKey];
        delete this.studyPatient[studyKey];

        [...this.studyVolumes[studyKey]].forEach((volumeKey) =>
          this.deleteVolume(volumeKey)
        );
        delete this.studyVolumes[studyKey];

        removeFromArray(this.patientStudies[patientKey], studyKey);
        if (this.patientStudies[patientKey].length === 0) {
          this.deletePatient(patientKey);
        }
      }
    },

    deletePatient(patientKey: string) {
      if (patientKey in this.patientInfo) {
        delete this.patientInfo[patientKey];

        [...this.patientStudies[patientKey]].forEach((studyKey) =>
          this.deleteStudy(studyKey)
        );
        delete this.patientStudies[patientKey];
      }
    },

    async serialize(stateFile: StateFile) {
      const dataIDs = Object.keys(this.volumeInfo);
      await serializeData(stateFile, dataIDs, DatasetType.DICOM);
    },

    async deserialize(files: FileDataSource[]) {
      return this.importFiles(files).then((volumeKeys) => {
        if (volumeKeys.length !== 1) {
          // Volumes are store individually so we should get one back.
          throw new Error('Invalid state file.');
        }

        return volumeKeys[0];
      });
    },

    // returns an ITK image object
    async getVolumeSlice(
      volumeKey: string,
      sliceIndex: number,
      asThumbnail = false
    ) {
      const fileStore = useFileStore();

      const cacheKey = imageCacheMultiKey(sliceIndex, asThumbnail);
      if (
        volumeKey in this.sliceData &&
        cacheKey in this.sliceData[volumeKey]
      ) {
        return this.sliceData[volumeKey][cacheKey];
      }

      if (!(volumeKey in this.volumeInfo)) {
        throw new Error(`Cannot find given volume key: ${volumeKey}`);
      }
      const volumeInfo = this.volumeInfo[volumeKey];
      const numSlices = volumeInfo.NumberOfSlices;

      if (sliceIndex < 1 || sliceIndex > numSlices) {
        throw new Error(`Slice ${sliceIndex} is out of bounds`);
      }

      const volumeFiles = fileStore.getFiles(volumeKey);

      if (!volumeFiles) {
        throw new Error(`No files found for volume key: ${volumeKey}`);
      }

      const sliceFile = volumeFiles[sliceIndex - 1];

      const itkImage = await readVolumeSlice(sliceFile, asThumbnail);

      this.sliceData[volumeKey][cacheKey] = itkImage;
      return itkImage;
    },

    // returns an ITK image object
    async getVolumeThumbnail(volumeKey: string) {
      const { NumberOfSlices } = this.volumeInfo[volumeKey];
      const middleSlice = Math.ceil(NumberOfSlices / 2);
      return this.getVolumeSlice(volumeKey, middleSlice, true);
    },

    async buildVolume(volumeKey: string, forceRebuild: boolean = false) {
      const imageStore = useImageStore();

      const rebuild = forceRebuild || this.needsRebuild[volumeKey];

      if (!rebuild && this.volumeToImageID[volumeKey]) {
        const imageID = this.volumeToImageID[volumeKey]!;
        return imageStore.dataIndex[imageID];
      }

      const fileStore = useFileStore();
      const files = fileStore.getFiles(volumeKey);
      if (!files) throw new Error('No files for volume key');
      const image = vtkITKHelper.convertItkToVtkImage(await buildImage(files));

      const existingImageID = this.volumeToImageID[volumeKey];
      if (existingImageID) {
        imageStore.updateData(existingImageID, image);
      } else {
        const info = this.volumeInfo[volumeKey];
        const name =
          cleanupName(info.SeriesDescription) || info.SeriesInstanceUID;
        const imageID = imageStore.addVTKImageData(name, image);
        this.imageIDToVolumeKey[imageID] = volumeKey;
        this.volumeToImageID[volumeKey] = imageID;
      }

      delete this.needsRebuild[volumeKey];

      return image;
    },
  },
});
