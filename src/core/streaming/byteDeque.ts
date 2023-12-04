/**
 * A byte array deque.
 */
export default class ByteDeque {
  private arrays: Uint8Array[];
  private _size = 0;

  constructor() {
    this.arrays = [];
  }

  get size() {
    return this._size;
  }

  isEmpty() {
    return this.size === 0;
  }

  /**
   * Push a new Uint8Array to the end.
   * @param {Uint8Array} bytes
   */
  pushEnd(bytes: Uint8Array) {
    this.arrays.push(bytes);
    this._size += bytes.length;
  }

  /**
   * Push a new Uint8Array to the start.
   * @param {Uint8Array} bytes
   */
  pushStart(bytes: Uint8Array) {
    this.arrays.unshift(bytes);
    this._size += bytes.length;
  }

  /**
   * Pop <count> bytes off the end.
   * @param {number} count
   * @param discard do not return the popped bytes
   */
  popEnd(count: number, discard = false) {
    let processed = 0;
    const popped = discard ? null : new Uint8Array(count);
    let writeOffset = 0;

    while (processed < count && this.arrays.length) {
      const bytes = this.arrays.pop()!;
      const remaining = count - processed;
      // chomp bytes[offset:]
      const offset = remaining >= bytes.length ? 0 : remaining;
      const takeEntireArray = offset === 0;

      if (popped) {
        const toSet = takeEntireArray ? bytes : bytes.subarray(offset);
        popped.set(toSet, writeOffset);
        writeOffset += toSet.length;
      }

      if (!takeEntireArray) {
        // put back remainder
        this.arrays.push(bytes.subarray(0, offset));
      }

      processed += bytes.length - offset;
    }

    this._size = Math.max(0, this._size - count);
    return popped ?? undefined;
  }

  /**
   * Pop <count> bytes off the end.
   * @param {number} count
   * @param discard do not return the popped bytes
   */
  popStart(count: number, discard = false) {
    let processed = 0;
    const popped = discard ? null : new Uint8Array(count);
    let writeOffset = 0;

    while (processed < count && this.arrays.length) {
      const bytes = this.arrays.shift()!;
      const remaining = count - processed;
      // chomp bytes[:offset]
      const offset = Math.min(remaining, bytes.length);
      const takeEntireArray = offset === bytes.length;

      if (popped) {
        const toSet = takeEntireArray ? bytes : bytes.subarray(0, offset);
        popped.set(toSet, writeOffset);
        writeOffset += toSet.length;
      }

      if (!takeEntireArray) {
        // put back remainder
        this.arrays.unshift(bytes.subarray(offset));
      }

      processed += offset;
    }

    this._size = Math.max(0, this._size - count);
    return popped ?? undefined;
  }

  popAll(discard = false) {
    if (discard) {
      this.arrays.length = 0;
      return undefined;
    }
    return this.popStart(this.size);
  }
}
