import { BufferReader } from "../../src/networked-dom-v0.2/BufferReader";
import { BufferWriter } from "../../src/networked-dom-v0.2/BufferWriter";
import {
  decodePing,
  encodePing,
  NetworkedDOMV02PingMessage,
} from "../../src/networked-dom-v0.2/messages/from-server/ping";
import { PingMessageType } from "../../src/networked-dom-v0.2/messageTypes";

const cases: Array<[string, NetworkedDOMV02PingMessage, Array<number>]> = [
  [
    "ping message",
    {
      type: "ping",
      ping: 123,
      documentTime: 1735732759569,
    },
    [11, 123, 145, 152, 240, 141, 194, 50],
  ],
  [
    "ping message with large ping",
    {
      type: "ping",
      ping: 1234567890,
      documentTime: 1735732759569,
    },
    [11, 210, 133, 216, 204, 4, 145, 152, 240, 141, 194, 50],
  ],
];

describe("encode/decode ping", () => {
  test.each(cases)("%p", (name, message, expectedResult) => {
    const writer = new BufferWriter(16);
    encodePing(message, writer);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUInt8()).toEqual(PingMessageType);
    const decoded = decodePing(reader);
    expect(decoded).toEqual(message);
  });
});
