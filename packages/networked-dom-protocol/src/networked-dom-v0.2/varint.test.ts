import { BufferReader } from "./BufferReader";
import { BufferWriter } from "./BufferWriter";

describe("varint", () => {
  const varintCases: Array<[number, Array<number>]> = [
    [0, [0]],
    [1, [2]],
    [-1, [1]],
    [2, [4]],
    [-2, [3]],
    [123, [246, 1]],
    [-123, [245, 1]],
    [2147483647, [254, 255, 255, 255, 15]],
    [-2147483648, [255, 255, 255, 255, 15]],
    [1735732759569, [162, 176, 224, 155, 132, 101]],
    [-1735732759569, [161, 176, 224, 155, 132, 101]],
    [1735732759570, [164, 176, 224, 155, 132, 101]],
    [-1735732759570, [163, 176, 224, 155, 132, 101]],
  ];

  test.each(varintCases)("varint: %p", (value, expectedResult) => {
    const writer = new BufferWriter(4);
    writer.writeVarint(value);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readVarint()).toEqual(value);
  });

  test("varint 0-100000000", () => {
    for (let i = 0; i < 100000000; i += 10383) {
      const writer = new BufferWriter(4);
      writer.writeVarint(i);
      const encoded = writer.getBuffer();
      const reader = new BufferReader(encoded);
      expect(reader.readVarint()).toEqual(i);
    }
  });
});
