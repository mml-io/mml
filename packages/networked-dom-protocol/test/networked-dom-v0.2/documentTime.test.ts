import { BufferReader } from "../../src/networked-dom-v0.2/BufferReader";
import { BufferWriter } from "../../src/networked-dom-v0.2/BufferWriter";
import {
  decodeDocumentTime,
  encodeDocumentTime,
  NetworkedDOMV02DocumentTimeMessage,
} from "../../src/networked-dom-v0.2/messages/from-server/documentTime";
import { DocumentTimeMessageType } from "../../src/networked-dom-v0.2/messageTypes";

const cases: Array<[string, NetworkedDOMV02DocumentTimeMessage, Array<number>]> = [
  [
    "time message",
    {
      type: "documentTime",
      documentTime: 1735732759569,
    },
    [3, 145, 152, 240, 141, 194, 50],
  ],
];

describe("encode/decode documentTime", () => {
  test.each(cases)("%p", (name, message, expectedResult) => {
    const writer = new BufferWriter(16);
    encodeDocumentTime(message, writer);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUInt8()).toEqual(DocumentTimeMessageType);
    const decoded = decodeDocumentTime(reader);
    expect(decoded).toEqual(message);
  });
});
