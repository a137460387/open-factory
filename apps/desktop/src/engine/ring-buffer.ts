/**
 * Ring Buffer for streaming data
 *
 * Sprint AU: Provides a fixed-size circular buffer for streaming
 * audio/video data, avoiding repeated allocations.
 */

export class RingBuffer {
  private data: Uint8Array;
  private capacity: number;
  private writePos: number;
  private readPos: number;
  private len: number;

  constructor(capacity: number) {
    this.data = new Uint8Array(capacity);
    this.capacity = capacity;
    this.writePos = 0;
    this.readPos = 0;
    this.len = 0;
  }

  /**
   * Write data into the ring buffer.
   * Returns the number of bytes written.
   */
  write(data: Uint8Array): number {
    const available = this.capacity - this.len;
    const toWrite = Math.min(data.length, available);

    for (let i = 0; i < toWrite; i++) {
      this.data[this.writePos] = data[i];
      this.writePos = (this.writePos + 1) % this.capacity;
    }

    this.len += toWrite;
    return toWrite;
  }

  /**
   * Read data from the ring buffer.
   * Returns the number of bytes read.
   */
  read(buf: Uint8Array): number {
    const toRead = Math.min(buf.length, this.len);

    for (let i = 0; i < toRead; i++) {
      buf[i] = this.data[this.readPos];
      this.readPos = (this.readPos + 1) % this.capacity;
    }

    this.len -= toRead;
    return toRead;
  }

  /**
   * Get the number of bytes available to read.
   */
  available(): number {
    return this.len;
  }

  /**
   * Get the number of bytes available to write.
   */
  freeSpace(): number {
    return this.capacity - this.len;
  }

  /**
   * Check if the buffer is empty.
   */
  isEmpty(): boolean {
    return this.len === 0;
  }

  /**
   * Check if the buffer is full.
   */
  isFull(): boolean {
    return this.len === this.capacity;
  }

  /**
   * Clear the buffer.
   */
  clear(): void {
    this.writePos = 0;
    this.readPos = 0;
    this.len = 0;
  }
}
