import { getRequestPool } from '@/src/core/streaming/requestPool';
import { ResumableFetcher } from '@/src/core/streaming/resumableFetcher';
import StreamingByteReader from '@/src/core/streaming/streamingByteReader';
import { ImportHandler } from '@/src/io/import/common';
import { getFileMimeFromMagicStream } from '@/src/io/magic';
import { asCoroutine } from '@/src/utils';
import { canFetchUrl } from '@/src/utils/fetch';

const DoneSignal = Symbol('DoneSignal');

function detectStreamType(stream: ReadableStream) {
  return new Promise<string>((resolve, reject) => {
    const reader = new StreamingByteReader();
    const consume = asCoroutine(getFileMimeFromMagicStream(reader));
    const chunks: Uint8Array[] = [];

    const writableStream = new WritableStream({
      write(chunk) {
        chunks.push(chunk);
        const result = consume(chunk);
        if (result.done) {
          const mime = result.value;
          if (mime) resolve(mime);
          throw DoneSignal;
        }
      },
    });

    stream.pipeTo(writableStream).catch((err) => {
      if (err !== DoneSignal) {
        reject(err);
      }
    });
  });
}

const updateUriType: ImportHandler = async (dataSource) => {
  const { fileSrc, uriSrc } = dataSource;
  if (fileSrc || !uriSrc || !canFetchUrl(uriSrc.uri)) {
    return dataSource;
  }

  const fetcher =
    uriSrc.fetcher ??
    new ResumableFetcher(uriSrc.uri, {
      fetch: (...args) => getRequestPool().fetch(...args),
    });

  const abortController = new AbortController();
  const stream = await fetcher.start({
    abortController,
  });
  const mime = await detectStreamType(stream);

  // properly close the stream
  abortController.abort();

  if (!mime) {
    throw new Error('No mimetype detected in the stream');
  }

  const streamDataSource = {
    ...dataSource,
    uriSrc: {
      ...uriSrc,
      mime,
      fetcher,
    },
  };

  return streamDataSource;
};

export default updateUriType;
