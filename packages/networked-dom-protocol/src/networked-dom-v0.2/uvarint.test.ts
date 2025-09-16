import { BufferReader } from "./BufferReader";
import { BufferWriter } from "./BufferWriter";

describe("uvarint", () => {
  const uvarintCases: Array<[number, Array<number>]> = [
    [0, [0]],
    [1, [1]],
    [127, [127]],
    [128, [128, 1]],
    [129, [129, 1]],
    [255, [255, 1]],
    [256, [128, 2]],
    [257, [129, 2]],
    [320, [192, 2]],
    [382, [254, 2]],
    [383, [255, 2]],
    [384, [128, 3]],
    [385, [129, 3]],
    [509, [253, 3]],
    [510, [254, 3]],
    [511, [255, 3]],
    [512, [128, 4]],
    [513, [129, 4]],
    [173573, [133, 204, 10]],
    [17357327, [143, 180, 163, 8]],
    [268435454, [254, 255, 255, 127]],
    [268435455, [255, 255, 255, 127]],
    [268435456, [128, 128, 128, 128, 1]],
    [268435457, [129, 128, 128, 128, 1]],
    [1735732759, [151, 220, 212, 187, 6]],
    [2147483647, [255, 255, 255, 255, 7]],
    [2147483648, [128, 128, 128, 128, 8]],
    [1735732759569, [145, 152, 240, 141, 194, 50]],
  ];

  test.each(uvarintCases)("uvarint: %p", (value, expectedResult) => {
    const writer = new BufferWriter(4);
    writer.writeUVarint(value);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUVarint()).toEqual(value);
  });

  test("uvarint 0-100000000", () => {
    for (let i = 0; i < 100000000; i += 10383) {
      const writer = new BufferWriter(4);
      writer.writeUVarint(i);
      const encoded = writer.getBuffer();
      const reader = new BufferReader(encoded);
      expect(reader.readUVarint()).toEqual(i);
    }
  });
});
