import RewindableStreamingByteReader from '@/src/core/streaming/rewindableStreamingByteReader';
import { describe, expect, it } from 'vitest';

describe('RewindableStreamingByteReader', () => {
  it('should be rewindable', () => {
    const reader = new RewindableStreamingByteReader();
    reader.enableRewind();

    let seekg = reader.seek(5);
    seekg.next();
    seekg.next(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));

    expect(reader.position).to.equal(5);

    seekg = reader.seek(-4);
    seekg.next();

    expect(reader.position).to.equal(1);

    const readg = reader.read(4);
    const result = readg.next();
    expect(result.done).to.be.true;
    expect(result.value).to.eql(new Uint8Array([2, 3, 4, 5]));
  });

  it('should rewind to beginningg of stream', () => {
    const reader = new RewindableStreamingByteReader();
    reader.enableRewind();

    const seekg = reader.seek(5);
    seekg.next();
    seekg.next(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));

    reader.seek(-6).next();

    expect(reader.position).to.equal(0);
  });

  it('should support disabling rewind / selective rewind buffering', () => {
    const reader = new RewindableStreamingByteReader();
    reader.enableRewind();

    const seekg = reader.seek(5);
    seekg.next();
    seekg.next(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));

    reader.disableRewind();
    reader.seek(3).next();

    reader.seek(-10).next();

    const result = reader.read(7).next();
    expect(result.done).to.be.true;
    expect(result.value).to.eql(new Uint8Array([1, 2, 3, 4, 5, 9, 10]));
  });
});
