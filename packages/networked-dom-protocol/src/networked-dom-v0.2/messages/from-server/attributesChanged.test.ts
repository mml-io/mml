import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { AttributesChangedMessageType } from "../../messageTypes";
import {
  decodeAttributesChanged,
  encodeAttributesChanged,
  NetworkedDOMV02AttributesChangedDiff,
} from "./attributesChanged";

const cases: Array<[string, NetworkedDOMV02AttributesChangedDiff, Array<number>]> = [
  [
    "empty",
    {
      type: "attributesChanged",
      nodeId: 123,
      attributes: [],
    },
    [6, 123, 0],
  ],
  [
    "with attributes",
    {
      type: "attributesChanged",
      nodeId: 123,
      attributes: [
        ["key1", "value1"],
        ["key2", "value2"],
      ],
    },
    [
      6, 123, 2, 8, 107, 101, 121, 49, 6, 118, 97, 108, 117, 101, 49, 8, 107, 101, 121, 50, 6, 118,
      97, 108, 117, 101, 50,
    ],
  ],
  [
    "large node id and attribute removal",
    {
      type: "attributesChanged",
      nodeId: 12345,
      attributes: [
        ["key1", "value1"],
        ["key2", null],
      ],
    },
    [6, 185, 96, 2, 8, 107, 101, 121, 49, 6, 118, 97, 108, 117, 101, 49, 7, 107, 101, 121, 50],
  ],
  [
    "empty attribute string",
    {
      type: "attributesChanged",
      nodeId: 1,
      attributes: [["key1", ""]],
    },
    [6, 1, 1, 8, 107, 101, 121, 49, 0],
  ],
];

describe("encode/decode attributesChanged", () => {
  test.each(cases)("%p", (name, message, expectedResult) => {
    const writer = new BufferWriter(16);
    encodeAttributesChanged(message, writer);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUInt8()).toEqual(AttributesChangedMessageType);
    const decoded = decodeAttributesChanged(reader);
    expect(decoded).toEqual(message);
  });
});
