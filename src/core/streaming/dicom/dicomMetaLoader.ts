import { createDicomParser } from '@/src/core/streaming/dicom/dicomParser';
import { Fetcher, MetaLoader } from '@/src/core/streaming/types';
import { Maybe } from '@/src/types';
import { Awaitable } from '@vueuse/core';

const DoneSignal = Symbol('DoneSignal');

export type ReadDicomTagsFunction = (
  file: File
) => Awaitable<Array<[string, string]>>;

export class DicomMetaLoader implements MetaLoader {
  public tags: Maybe<Array<[string, string]>>;

  private abortController: Maybe<AbortController>;

  constructor(
    private fetcher: Fetcher,
    private readDicomTags: ReadDicomTagsFunction
  ) {
    this.abortController = null;
  }

  async load() {
    if (this.tags) return;
    if (this.abortController) throw new Error('Loader already started');

    this.abortController = new AbortController();
    const stream = await this.fetcher.start({
      abortController: this.abortController,
    });

    const parse = createDicomParser(12);

    const sinkStream = new WritableStream({
      write: (chunk) => {
        const result = parse(chunk);
        if (result.done) {
          this.abortController?.abort(DoneSignal);
        }
      },
    });

    try {
      await stream.pipeTo(sinkStream, {
        signal: this.abortController.signal,
      });
    } catch (err) {
      if (err !== DoneSignal) {
        this.abortController = null;
        throw err;
      }
    }

    const metadataFile = new File(this.fetcher.dataChunks, 'file.dcm');
    this.tags = await this.readDicomTags(metadataFile);
    this.abortController = null;
  }

  stop() {
    if (!this.abortController) return;

    this.abortController.abort();
    this.abortController = null;
  }
}
