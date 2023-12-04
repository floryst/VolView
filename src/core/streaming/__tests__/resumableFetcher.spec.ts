/* eslint-disable no-restricted-syntax */
import { RequestPool } from '@/src/core/streaming/requestPool';
import {
  ResumableFetcher,
  StopSignal,
} from '@/src/core/streaming/resumableFetcher';
import { describe, expect, it } from 'vitest';

describe('ResumableFetcher', () => {
  it('should support stopping and resuming', async () => {
    const pool = new RequestPool();
    const fetcher = new ResumableFetcher(
      'https://data.kitware.com/api/v1/file/57b5d4648d777f10f2693e7e/download',
      {
        fetch: pool.fetch,
      }
    );

    let stream = await fetcher.start();
    let size = 0;
    try {
      // @ts-ignore
      for await (const chunk of stream) {
        size += chunk.length;
        if (size > 4096 * 3) {
          fetcher.stop();
        }
      }
    } catch (err) {
      if (err !== StopSignal) throw err;
    }

    stream = await fetcher.start();
    // @ts-ignore
    for await (const chunk of stream) {
      size += chunk.length;
    }

    expect(size).to.equal(fetcher.size);
  });
});
