import { Maybe } from '@/src/types';
import { Awaitable } from '@vueuse/core';

export type LoaderEvents = {
  error: any;
  done: any;
};

interface Loader {
  load(): Awaitable<void>;
  stop(): Awaitable<void>;
}

/**
 * A metadata loader.
 */
export interface MetaLoader extends Loader {
  meta: Maybe<Array<[string, string]>>;
  metaBlob: Maybe<Blob>;
}

/**
 * A data loader.
 */
export interface DataLoader extends Loader {
  data: Maybe<Blob>;
}

/**
 * Init options for a Fetcher.
 */
export interface FetcherInit {
  abortController?: AbortController;
}

/**
 * A generic stoppable fetcher.
 */
export interface Fetcher {
  start(init?: FetcherInit): Promise<ReadableStream>;
  stop(): void;
  dataChunks: Uint8Array[];
  running: boolean;
  done: boolean;
  size: number;
}
