import ByteDeque from '@/src/core/streaming/byteDeque';
import StreamingByteReader from '@/src/core/streaming/streamingByteReader';

/**
 * RewindableStreamingByteReader
 *
 * A streaming byte reader with rewind capability.
 *
 * Rewind is on by default for newly created byte readers.
 *
 * Rewind capability can be toggled in the event this byte reader
 * becomes positive seek only. The rewind buffer will be filled only
 * if the rewindable capability is enabled.
 */
export default class RewindableStreamingByteReader extends StreamingByteReader {
  protected consumed: ByteDeque;
  private _rewindable: boolean;

  constructor() {
    super();
    this.consumed = new ByteDeque();
    this._rewindable = true;
  }

  /**
   * Is the reader rewindable (negative seeks).
   */
  get rewindable() {
    return this._rewindable;
  }

  enableRewind() {
    this._rewindable = true;
  }

  disableRewind() {
    this._rewindable = false;
  }

  /**
   * Seeks along the byte stream.
   *
   * Allows for negative seeking. Seeking to -Infinity or any offset delta
   * past the beginning of the rewind buffer will go to the beginning of the
   * rewind buffer.
   * @param offset
   * @returns
   */
  *seek(offset: number) {
    if (offset >= 0) {
      yield* this.read(offset);
      return;
    }

    const revOffset = -offset;

    const seekBos = revOffset >= this.consumed.size;
    if (seekBos) {
      this.leftover.pushStart(this.consumed);
      this.pos = 0;
    } else {
      this.leftover.pushStart(this.consumed.popEnd(revOffset)!);
      this.pos -= revOffset;
    }
  }

  /**
   * Reads a number of bytes.
   * @param length
   * @param opts
   * @returns
   */
  *read(length: number, opts?: { peek?: boolean }) {
    const data = yield* super.read(length, opts);
    if (this._rewindable) this.consumed.pushEnd(data);
    return data;
  }
}
