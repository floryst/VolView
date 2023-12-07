import { Chunk } from '@/src/core/streaming/chunk';
import { DicomDataLoader } from '@/src/core/streaming/dicom/dicomDataLoader';
import {
  DicomMetaLoader,
  ReadDicomTagsFunction,
} from '@/src/core/streaming/dicom/dicomMetaLoader';
import { ResumableFetcher } from '@/src/core/streaming/resumableFetcher';
import { ImportHandler } from '@/src/io/import/common';
import { FILE_EXT_TO_MIME } from '@/src/io/mimeTypes';
import { readDicomTags } from '@itk-wasm/dicom';

let worker: Worker | null = null;

const handleDicomStream: ImportHandler = async (dataSource, { done }) => {
  const { fileSrc, uriSrc } = dataSource;
  if (fileSrc || uriSrc?.mime !== FILE_EXT_TO_MIME.dcm) {
    return dataSource;
  }

  const fetcher = new ResumableFetcher(uriSrc.uri, {
    prefixChunks: uriSrc.bytes,
    fetch: (...args) => fetch(...args),
  });
  const readTags: ReadDicomTagsFunction = async (file) => {
    const result = await readDicomTags(worker, file);
    worker = result.webWorker;
    return result.tags;
  };

  const metaLoader = new DicomMetaLoader(fetcher, readTags);
  const dataLoader = new DicomDataLoader(fetcher);
  const chunk = new Chunk({
    metaLoader,
    dataLoader,
  });

  await chunk.loadMeta();

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

export default handleDicomStream;
