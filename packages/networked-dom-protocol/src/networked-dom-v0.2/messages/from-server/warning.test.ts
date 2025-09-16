import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { WarningMessageType } from "../../messageTypes";
import { decodeWarning, encodeWarning, NetworkedDOMV02WarningMessage } from "./warning";

const cases: Array<[string, NetworkedDOMV02WarningMessage, Array<number>]> = [
  [
    "empty warning",
    {
      type: "warning",
      message: "",
    },
    [12, 0],
  ],
  [
    "simple warning",
    {
      type: "warning",
      message: "This is a warning",
    },
    [12, 17, 84, 104, 105, 115, 32, 105, 115, 32, 97, 32, 119, 97, 114, 110, 105, 110, 103],
  ],
  [
    "long warning message",
    {
      type: "warning",
      message:
        "This is a very long warning message that exceeds the typical short message length and should test the uvarint encoding for longer strings properly",
    },
    [
      12, 146, 1, 84, 104, 105, 115, 32, 105, 115, 32, 97, 32, 118, 101, 114, 121, 32, 108, 111,
      110, 103, 32, 119, 97, 114, 110, 105, 110, 103, 32, 109, 101, 115, 115, 97, 103, 101, 32, 116,
      104, 97, 116, 32, 101, 120, 99, 101, 101, 100, 115, 32, 116, 104, 101, 32, 116, 121, 112, 105,
      99, 97, 108, 32, 115, 104, 111, 114, 116, 32, 109, 101, 115, 115, 97, 103, 101, 32, 108, 101,
      110, 103, 116, 104, 32, 97, 110, 100, 32, 115, 104, 111, 117, 108, 100, 32, 116, 101, 115,
      116, 32, 116, 104, 101, 32, 117, 118, 97, 114, 105, 110, 116, 32, 101, 110, 99, 111, 100, 105,
      110, 103, 32, 102, 111, 114, 32, 108, 111, 110, 103, 101, 114, 32, 115, 116, 114, 105, 110,
      103, 115, 32, 112, 114, 111, 112, 101, 114, 108, 121,
    ],
  ],
];

describe("encode/decode warning", () => {
  test.each(cases)("%p", (name, message, expectedResult) => {
    const writer = new BufferWriter(16);
    encodeWarning(message, writer);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUInt8()).toEqual(WarningMessageType);
    const decoded = decodeWarning(reader);
    expect(decoded).toEqual(message);
  });
});
