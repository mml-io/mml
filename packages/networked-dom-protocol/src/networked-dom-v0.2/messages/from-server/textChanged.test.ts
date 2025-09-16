import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { TextChangedMessageType } from "../../messageTypes";
import {
  decodeTextChanged,
  encodeTextChanged,
  NetworkedDOMV02TextChangedDiff,
} from "./textChanged";

const cases: Array<[string, NetworkedDOMV02TextChangedDiff, Array<number>]> = [
  [
    "empty text",
    {
      type: "textChanged",
      nodeId: 123,
      text: "",
    },
    [9, 123, 0],
  ],
  [
    "simple text",
    {
      type: "textChanged",
      nodeId: 1,
      text: "Hello World",
    },
    [9, 1, 11, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100],
  ],
  [
    "large node id and unicode text",
    {
      type: "textChanged",
      nodeId: 12345,
      text: "Hello 🌍",
    },
    [9, 185, 96, 10, 72, 101, 108, 108, 111, 32, 240, 159, 140, 141],
  ],
  [
    "multiline text",
    {
      type: "textChanged",
      nodeId: 42,
      text: "Line 1\nLine 2\nLine 3",
    },
    [
      9, 42, 20, 76, 105, 110, 101, 32, 49, 10, 76, 105, 110, 101, 32, 50, 10, 76, 105, 110, 101,
      32, 51,
    ],
  ],
];

describe("encode/decode textChanged", () => {
  test.each(cases)("%p", (name, message, expectedResult) => {
    const writer = new BufferWriter(16);
    encodeTextChanged(message, writer);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUInt8()).toEqual(TextChangedMessageType);
    const decoded = decodeTextChanged(reader);
    expect(decoded).toEqual(message);
  });
});
