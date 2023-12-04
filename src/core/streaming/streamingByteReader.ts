import ByteDeque from '@/src/core/streaming/byteDeque.js';
import { toAscii } from '@/src/utils';

/**
 * StreamingByteReader
 *
 * Expects Uint8Array inputs
 */
export default class StreamingByteReader {
  private leftover: ByteDeque;
  private pos = 0;

  constructor() {
    this.leftover = new ByteDeque();
  }

  get position() {
    return this.pos;
  }

  /**
   * Seeks along the byte stream.
   *
   * No negative values.
   * @param offset
   */
  *seek(offset: number) {
    if (offset < 0) {
      throw new Error('Offset must not be negative');
    }

    let remaining = offset;
    while (remaining > 0) {
      if (this.leftover.isEmpty()) {
        this.leftover.pushEnd(yield);
      }
      const leftoverSize = this.leftover.size;
      this.leftover.popStart(remaining, true);
      remaining -= leftoverSize;
    }

    this.pos += offset;
  }

  /**
   * Reads a number of byte.
   * @param length
   * @param param1
   * @returns
   */
  *read(
    length: number,
    { peek = false } = {}
  ): Generator<undefined, Uint8Array, Uint8Array> {
    if (length <= 0) {
      throw new Error('Length must be a positive number');
    }

    if (this.leftover.size >= length) {
      const data = this.leftover.popStart(length);
      if (data) {
        if (peek) {
          this.leftover.pushStart(data);
        } else {
          this.pos += length;
        }
        return data;
      }
    }

    const data = new Uint8Array(length);
    let offset = 0;

    // ingest all leftover bytes
    if (this.leftover.size) {
      offset = this.leftover.size;
      data.set(this.leftover.popAll()!, 0);
    }

    while (offset < length) {
      const bytes = yield;
      const remaining = length - offset;
      if (bytes.length <= remaining) {
        data.set(bytes, offset);
        offset += bytes.length;
      } else {
        data.set(bytes.subarray(0, remaining), offset);
        offset = length;
        this.leftover.pushStart(bytes.subarray(remaining));
      }
    }

    if (peek) {
      this.leftover.pushStart(data);
    } else {
      this.pos += length;
    }
    return data;
  }

  /**
   * Reads an ASCII string.
   * @param length
   * @param param1
   * @returns
   */
  *readAscii(length: number, { ignoreNulls = false, peek = false } = {}) {
    const bytes = yield* this.read(length, { peek });
    return toAscii(bytes, { ignoreNulls });
  }

  /**
   *
   * @param {'getUint8' | 'getInt8' | ...} method
   * @param length must be the length associated with the method
   */
  private *readDataView<T extends keyof DataView>(
    method: T extends `get${infer R}` ? `get${R}` : never,
    length: number,
    { littleEndian = false, peek = false } = {}
  ) {
    const bytes = yield* this.read(length, { peek });
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (method === 'getUint8' || method === 'getInt8') {
      return dv[method](0) as number;
    }
    return dv[method](0, littleEndian) as number;
  }

  *readUint8() {
    return yield* this.readDataView('getUint8', 1);
  }

  *readInt8() {
    return yield* this.readDataView('getInt8', 1);
  }

  *readUint16(opts = {}) {
    return yield* this.readDataView('getUint16', 2, opts);
  }

  *readInt16(opts = {}) {
    return yield* this.readDataView('getInt16', 2, opts);
  }

  *readUint32(opts = {}) {
    return yield* this.readDataView('getUint32', 4, opts);
  }

  *readInt32(opts = {}) {
    return yield* this.readDataView('getInt32', 4, opts);
  }
}
