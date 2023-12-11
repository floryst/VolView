import { DataLoader, Fetcher } from '@/src/core/streaming/types';
import { FILE_EXT_TO_MIME } from '@/src/io/mimeTypes';
import { Maybe } from '@/src/types';

export class DicomDataLoader implements DataLoader {
  public data: Maybe<Blob>;

  private abortController: Maybe<AbortController>;

  constructor(private fetcher: Fetcher) {
    this.abortController = null;
  }

  async load() {
    if (this.abortController) throw new Error('Loader already started');

    this.abortController = new AbortController();
    const stream = await this.fetcher.start({
      abortController: this.abortController,
    });

    try {
      // consume the rest of the stream in order to cache the chunks
      await stream.pipeTo(new WritableStream());
      this.data = new Blob(this.fetcher.dataChunks, {
        type: FILE_EXT_TO_MIME.dcm,
      });
    } finally {
      this.abortController = null;
    }
  }

  stop() {
    if (!this.abortController) return;

    this.abortController.abort();
    this.abortController = null;
  }
}
