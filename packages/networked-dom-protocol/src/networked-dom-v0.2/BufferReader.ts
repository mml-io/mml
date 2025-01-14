const textDecoder = new TextDecoder();

export class BufferReader {
  private buffer: Uint8Array;
  private offset: number;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.offset = 0;
  }

  public readUInt8(): number {
    return this.buffer[this.offset++];
  }

  public readBoolean(): boolean {
    return this.readUInt8() === 1;
  }

  public readUVarint(signed = false): number {
    let lo = 0;
    let hi = 0;
    let i = 0;
    for (; i < 4; ++i) {
      lo = (lo | ((this.buffer[this.offset] & 127) << (i * 7))) >>> 0;
      if (this.buffer[this.offset++] < 128) {
        return signed ? loAndHiAsSigned(lo, hi) : loAndHiAsUnsigned(lo, hi);
      }
    }
    lo = (lo | ((this.buffer[this.offset] & 127) << 28)) >>> 0;
    hi = (hi | ((this.buffer[this.offset] & 127) >> 4)) >>> 0;
    if (this.buffer[this.offset++] < 128) {
      return signed ? loAndHiAsSigned(lo, hi) : loAndHiAsUnsigned(lo, hi);
    }
    i = 0;
    for (; i < 5; ++i) {
      hi = (hi | ((this.buffer[this.offset] & 127) << (i * 7 + 3))) >>> 0;
      if (this.buffer[this.offset++] < 128) {
        return signed ? loAndHiAsSigned(lo, hi) : loAndHiAsUnsigned(lo, hi);
      }
    }

    throw Error("invalid varint encoding");
  }

  public readUVarintPrefixedString(): string {
    const readLength = this.readUVarint();

    let string = "";
    let hasNonAscii = false;
    for (let i = 0; i < readLength; i++) {
      const charValue = this.buffer[this.offset + i];
      if (charValue < 0x80) {
        string += String.fromCharCode(charValue);
      } else {
        hasNonAscii = true;
        break;
      }
    }
    if (!hasNonAscii) {
      this.offset += readLength;
      return string;
    }

    // Slow path - decode the string using TextDecoder
    const result = textDecoder.decode(this.buffer.subarray(this.offset, this.offset + readLength));
    this.offset += readLength;
    return result;
  }

  // returns the string and a boolean indicating if the string was negative length
  public readVarintPrefixedString(): [string, boolean] {
    const length = this.readVarint();
    const negativeLength = length < 0;
    const readLength = negativeLength ? -length : length;

    let string = "";
    let hasNonAscii = false;
    for (let i = 0; i < readLength; i++) {
      const charValue = this.buffer[this.offset + i];
      if (charValue < 0x80) {
        string += String.fromCharCode(charValue);
      } else {
        hasNonAscii = true;
        break;
      }
    }
    if (!hasNonAscii) {
      this.offset += readLength;
      return [string, negativeLength];
    }

    // Slow path - decode the string using TextDecoder
    const result = textDecoder.decode(this.buffer.subarray(this.offset, this.offset + readLength));
    this.offset += readLength;
    return [result, negativeLength];
  }

  public readVarint(): number {
    return this.readUVarint(true);
  }

  public isEnd() {
    return this.offset >= this.buffer.length;
  }
}

function loAndHiAsSigned(lo: number, hi: number) {
  const value = lo + hi * 4294967296;
  if (value & 1) {
    return -(value + 1) / 2;
  }
  return value / 2;
}

function loAndHiAsUnsigned(lo: number, hi: number) {
  return lo + hi * 4294967296;
}
