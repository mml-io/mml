let textEncoder: TextEncoder | null = null;

function getTextEncoder(): TextEncoder {
  if (!textEncoder) {
    textEncoder = new TextEncoder();
  }
  return textEncoder;
}

export class BufferWriter {
  private buffer: Uint8Array;
  private offset: number;

  constructor(initialLength: number) {
    this.buffer = new Uint8Array(initialLength);
    this.offset = 0;
  }

  // Write an unsigned 8-bit integer
  public writeUint8(value: number): void {
    this.ensureCapacity(1);
    this.buffer[this.offset] = value & 0xff;
    this.offset += 1;
  }

  public writeBoolean(bool: boolean) {
    this.writeUint8(bool ? 1 : 0);
  }

  // Write an array of bytes
  public writeBytes(bytes: Uint8Array): void {
    this.ensureCapacity(bytes.byteLength);
    this.buffer.set(bytes, this.offset);
    this.offset += bytes.byteLength;
  }

  // Get the written bytes as a Uint8Array
  public getBuffer(): Uint8Array {
    return this.buffer.subarray(0, this.offset);
  }

  public getWrittenLength(): number {
    return this.offset;
  }

  // Ensure there is enough capacity in the buffer
  private ensureCapacity(neededSpace: number): void {
    while (this.offset + neededSpace > this.buffer.length) {
      this.expandBuffer();
    }
  }

  // Expand the buffer by doubling its current length
  private expandBuffer(): void {
    const newBuffer = new Uint8Array(this.buffer.length * 2);
    newBuffer.set(this.buffer);
    this.buffer = newBuffer;
  }

  public writeUVarint(x: number) {
    if (x <= 268435455) {
      // Simple case that can be handled without hi and lo
      this.ensureCapacity(4);
      while (x >= 0x80) {
        this.buffer[this.offset] = (x & 0x7f) | 0x80; // Extract least significant 7 bits and set continuation bit
        this.offset++;
        x >>>= 7; // Use unsigned shift here
      }
      this.buffer[this.offset] = x & 0x7f; // No need for 0xff here since we're limiting it to 7 bits
      this.offset++;
      return;
    }
    this.ensureCapacity(10);

    let lo = 0;
    let hi = 0;
    if (x !== 0) {
      lo = x >>> 0;
      hi = ((x - lo) / 4294967296) >>> 0;
    }

    while (hi) {
      this.buffer[this.offset++] = (lo & 127) | 128;
      lo = ((lo >>> 7) | (hi << 25)) >>> 0;
      hi >>>= 7;
    }
    while (lo > 127) {
      this.buffer[this.offset++] = (lo & 127) | 128;
      lo = lo >>> 7;
    }
    this.buffer[this.offset++] = lo;
  }

  public writeVarint(x: number) {
    if (x >= 0) {
      this.writeUVarint(x * 2);
    } else {
      this.writeUVarint(-x * 2 - 1);
    }
  }

  public writeLengthPrefixedString(value: string, varint = false, negativeLength = false) {
    /*
     Try fast case first - no non-ascii characters and byte length is string length.

     Even if this case fails (non-ascii character found) the data will always be
     shorter so it can be overwritten
    */
    const originalOffset = this.offset; // store this in case we need to overwrite from here
    // Just write the length of the string (not the known encoded length)
    if (varint) {
      this.writeVarint(negativeLength ? -value.length : value.length);
    } else {
      this.writeUVarint(value.length);
    }
    this.ensureCapacity(value.length); // Ensure we have enough space for the string
    let nonAscii = false;
    for (let i = 0; i < value.length; i++) {
      const charCode = value.charCodeAt(i);
      if (charCode > 0x7f) {
        nonAscii = true;
        break;
      }
      this.buffer[this.offset++] = charCode;
    }

    if (!nonAscii) {
      return;
    }

    /*
     If we have non-ascii characters, we need to encode the string respecting
     utf-8 and overwrite the buffer from the original offset
    */
    this.offset = originalOffset; // overwrite the length
    let encodedLength = value.length; // This will be overwritten once we know the actual length
    this.ensureCapacity(encodedLength); // This will be at least the required length, but it gives the chance of initially creating a large enough buffer
    while (true) {
      this.offset = originalOffset;
      if (varint) {
        this.writeVarint(negativeLength ? -encodedLength : encodedLength);
      } else {
        this.writeUVarint(encodedLength);
      }
      const offsetAfterVarint = this.offset;
      const varintLength = offsetAfterVarint - originalOffset;

      const writeBuffer = new Uint8Array(this.buffer.buffer, this.offset);
      const { read, written } = getTextEncoder().encodeInto(value, writeBuffer);
      if (read !== value.length) {
        // Need more space and try again
        this.expandBuffer();
        continue;
      }
      if (written !== encodedLength) {
        encodedLength = written;
        // We need to overwrite the varint with the correct length
        this.offset = originalOffset;
        if (varint) {
          this.writeVarint(negativeLength ? -encodedLength : encodedLength);
        } else {
          this.writeUVarint(encodedLength);
        }
        const newOffsetAfterVarint = this.offset;
        const actualVarintLength = newOffsetAfterVarint - originalOffset;
        if (actualVarintLength !== varintLength) {
          // The varint length changed and it has overwritten the string
          // We need to write the string again
          continue;
        } else {
          // The varint length is the same so the string is intact
        }
      }
      // String written successfully - update the offset
      this.offset += written;
      return;
    }
  }
}
