/**
 * Concatenates multiple streams together in order.
 * @param streams
 * @returns
 */
export function concatStreams<T>(
  ...streams: ReadableStream<T>[]
): ReadableStream<T> {
  let reader: ReadableStreamDefaultReader<T> | null = null;
  return new ReadableStream({
    pull(controller) {
      if (streams.length === 0) {
        controller.close();
        return Promise.resolve();
      }

      if (!reader) {
        reader = streams[0].getReader();
      }

      return reader.read().then((result) => {
        if (result.value) controller.enqueue(result.value);
        if (result.done) {
          streams.shift();
          reader = null;
        }
      });
    },
  });
}
