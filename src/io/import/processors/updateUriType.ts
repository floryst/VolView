import StreamingByteReader from '@/src/core/streaming/streamingByteReader';
import { ImportHandler } from '@/src/io/import/common';
import { getFileMimeFromMagicStream } from '@/src/io/magic';
import { Maybe } from '@/src/types';
import { asCoroutine } from '@/src/utils';
import { canFetchUrl, fetchResponse } from '@/src/utils/fetch';

type TypeDetectionResult = {
  mime: Maybe<string>;
  chunks: Uint8Array[];
};

function detectStreamType(stream: ReadableStream) {
  return new Promise<TypeDetectionResult>((resolve, reject) => {
    const reader = new StreamingByteReader();
    const consume = asCoroutine(getFileMimeFromMagicStream(reader));
    const chunks: Uint8Array[] = [];

    const writableStream = new WritableStream({
      write(chunk) {
        chunks.push(chunk);
        const result = consume(chunk);
        if (result.done) {
          const mime = result.value;
          resolve({ mime, chunks });
          writableStream.getWriter().releaseLock();
          writableStream.close();
        }
      },
    });

    stream.pipeTo(writableStream).catch(reject);
  });
}

const updateUriType: ImportHandler = async (dataSource) => {
  const { fileSrc, uriSrc } = dataSource;
  if (fileSrc || !uriSrc || !canFetchUrl(uriSrc.uri)) {
    return dataSource;
  }

  const response = await fetchResponse(uriSrc.uri);
  if (!response.body) {
    throw new Error('No body in the response');
  }

  const { mime, chunks } = await detectStreamType(response.body);

  if (!mime) {
    throw new Error('No mimetype detected in the stream');
  }

  const streamDataSource = {
    ...dataSource,
    uriSrc: {
      ...uriSrc,
      mime,
      bytes: chunks,
    },
  };

  return streamDataSource;
};

export default updateUriType;
