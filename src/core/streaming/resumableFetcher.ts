import {
  HTTP_STATUS_OK,
  HTTP_STATUS_PARTIAL_CONTENT,
  HttpNotFound,
} from '@/src/core/streaming/httpCodes';
import { Fetcher, FetcherInit } from '@/src/core/streaming/types';
import { Maybe } from '@/src/types';

type FetchFunction = typeof fetch;

export interface ResumableRequestInit extends RequestInit {
  prefixChunks?: Uint8Array[];
  fetch?: FetchFunction;
}

export const StopSignal = Symbol('StopSignal');

export class ResumableFetcher implements Fetcher {
  private abortController: Maybe<AbortController>;
  private fetch: typeof fetch;
  private finished: boolean;
  private chunks: Uint8Array[];

  constructor(
    private request: RequestInfo | URL,
    private init?: ResumableRequestInit
  ) {
    this.finished = false;
    this.chunks = [...(init?.prefixChunks ?? [])];
    this.fetch = init?.fetch ?? globalThis.fetch;
  }

  get running() {
    return !!this.abortController;
  }

  get done() {
    return this.finished;
  }

  get size() {
    return this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  }

  get dataChunks() {
    return this.chunks;
  }

  /**
   * Starts a fetch and returns a ReadableStream.
   * @returns
   */
  async start(init?: FetcherInit) {
    if (this.running) throw new Error('Already started');

    this.abortController = init?.abortController ?? new AbortController();
    this.abortController.signal.addEventListener(
      'abort',
      this.clearAbortController
    );

    // Use fromEntries as a workaround to handle
    // jsdom not setting Range properly.
    const headers = Object.fromEntries(new Headers(this.init?.headers ?? {}));
    headers.Range = `bytes=${this.size}-`;

    const response = await this.fetch(new Request(this.request), {
      ...this.init,
      headers,
      signal: this.abortController.signal,
    });

    if (!response.body) throw new Error('Did not receive a response body');

    if (
      response.status !== HTTP_STATUS_OK &&
      response.status !== HTTP_STATUS_PARTIAL_CONTENT
    ) {
      throw new HttpNotFound();
    }

    if (response.status !== HTTP_STATUS_PARTIAL_CONTENT) {
      this.chunks = [];
    }

    const transformStream = new TransformStream({
      transform: (chunk, controller) => {
        this.chunks.push(chunk);
        controller.enqueue(chunk);
      },
      flush: () => {
        this.finished = true;
        this.clearAbortController();
      },
    });

    return response.body.pipeThrough(transformStream);
  }

  stop() {
    if (!this.abortController) return;
    this.abortController.abort(StopSignal);
    this.clearAbortController();
  }

  private clearAbortController = () => {
    this.abortController = null;
  };
}
