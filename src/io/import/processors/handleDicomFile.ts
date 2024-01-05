import { Chunk } from '@/src/core/streaming/chunk';
import { DicomFileDataLoader } from '@/src/core/streaming/dicom/dicomFileDataLoader';
import { DicomFileMetaLoader } from '@/src/core/streaming/dicom/dicomFileMetaLoader';
import { ReadDicomTagsFunction } from '@/src/core/streaming/dicom/dicomMetaLoader';
import { ImportHandler } from '@/src/io/import/common';
import { FILE_EXT_TO_MIME } from '@/src/io/mimeTypes';
import { readDicomTags } from '@itk-wasm/dicom';

// TODO combine with handleDicomStream
let worker: Worker | null = null;

/**
 * Adds DICOM files to the extra context.
 * @param dataSource
 * @returns
 */
const handleDicomFile: ImportHandler = async (dataSource, { done }) => {
  const { fileSrc } = dataSource;
  if (!fileSrc?.file || fileSrc?.fileType !== FILE_EXT_TO_MIME.dcm) {
    return dataSource;
  }

  const readTags: ReadDicomTagsFunction = async (file) => {
    const result = await readDicomTags(worker, file);
    worker = result.webWorker;
    return result.tags;
  };

  const metaLoader = new DicomFileMetaLoader(fileSrc.file, readTags);
  const dataLoader = new DicomFileDataLoader(fileSrc.file);
  const chunk = new Chunk({
    metaLoader,
    dataLoader,
  });

  // load the chunk metadata and data from the file directly
  await chunk.loadMeta();
  await chunk.loadData();

  return done({
    dataSource: {
      ...dataSource,
      chunkSrc: {
        chunk,
        mime: FILE_EXT_TO_MIME.dcm,
      },
    },
  });
};

export default handleDicomFile;
