import { BufferReader } from "./BufferReader";
import { BufferWriter } from "./BufferWriter";
import { decodeWarning, encodeWarning } from "./messages/from-server/warning";
import { NetworkedDOMV02WarningMessage } from "./messages/from-server/warning";
import { WarningMessageType } from "./messageTypes";

const cases: Array<[string, NetworkedDOMV02WarningMessage, Array<number>]> = [
  [
    "empty",
    {
      type: "warning",
      message: "",
    },
    [12, 0],
  ],
  [
    "with a long message",
    {
      type: "warning",
      message:
        "Some reasonably long warning message with some pointless extra words like these that ends up being quite long and causes the uvarint representing the message length to be greater than 128",
    },
    [
      12, 187, 1, 83, 111, 109, 101, 32, 114, 101, 97, 115, 111, 110, 97, 98, 108, 121, 32, 108,
      111, 110, 103, 32, 119, 97, 114, 110, 105, 110, 103, 32, 109, 101, 115, 115, 97, 103, 101, 32,
      119, 105, 116, 104, 32, 115, 111, 109, 101, 32, 112, 111, 105, 110, 116, 108, 101, 115, 115,
      32, 101, 120, 116, 114, 97, 32, 119, 111, 114, 100, 115, 32, 108, 105, 107, 101, 32, 116, 104,
      101, 115, 101, 32, 116, 104, 97, 116, 32, 101, 110, 100, 115, 32, 117, 112, 32, 98, 101, 105,
      110, 103, 32, 113, 117, 105, 116, 101, 32, 108, 111, 110, 103, 32, 97, 110, 100, 32, 99, 97,
      117, 115, 101, 115, 32, 116, 104, 101, 32, 117, 118, 97, 114, 105, 110, 116, 32, 114, 101,
      112, 114, 101, 115, 101, 110, 116, 105, 110, 103, 32, 116, 104, 101, 32, 109, 101, 115, 115,
      97, 103, 101, 32, 108, 101, 110, 103, 116, 104, 32, 116, 111, 32, 98, 101, 32, 103, 114, 101,
      97, 116, 101, 114, 32, 116, 104, 97, 110, 32, 49, 50, 56,
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
