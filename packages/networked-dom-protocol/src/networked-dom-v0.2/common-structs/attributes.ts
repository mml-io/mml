import { BufferReader } from "../BufferReader";
import { BufferWriter } from "../BufferWriter";

export function encodeAttribute(writer: BufferWriter, key: string, value: string | null) {
  if (value === null) {
    writer.writeLengthPrefixedString(key, true, true);
  } else {
    writer.writeLengthPrefixedString(key, true, false);
    writer.writeLengthPrefixedString(value);
  }
}

export function encodeAttributes(writer: BufferWriter, attributes: Array<[string, string | null]>) {
  writer.writeUVarint(attributes.length);

  for (let i = 0; i < attributes.length; i++) {
    encodeAttribute(writer, attributes[i][0], attributes[i][1]);
  }
}

export function decodeAttributes(buffer: BufferReader): Array<[string, string | null]> {
  const attributesLength = buffer.readUVarint();
  const attributes: Array<[string, string | null]> = [];
  for (let i = 0; i < attributesLength; i++) {
    const [key, negativeLength] = buffer.readVarintPrefixedString();
    if (negativeLength) {
      attributes.push([key, null]);
      continue;
    }
    const value = buffer.readUVarintPrefixedString();
    attributes.push([key, value]);
  }
  return attributes;
}
