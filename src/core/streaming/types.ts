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
export type MetaLoader = Loader;

/**
 * A data loader.
 */
export type DataLoader = Loader;

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
