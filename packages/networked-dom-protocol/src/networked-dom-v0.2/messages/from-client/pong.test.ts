import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { PongMessageType } from "../../messageTypes";
import { decodePong, encodePong, NetworkedDOMV02PongMessage } from "./pong";

const cases: Array<[string, NetworkedDOMV02PongMessage, Array<number>]> = [
  [
    "simple pong",
    {
      type: "pong",
      pong: 123,
    },
    [17, 123],
  ],
  [
    "pong with large value",
    {
      type: "pong",
      pong: 1234567890,
    },
    [17, 210, 133, 216, 204, 4],
  ],
  [
    "pong with zero value",
    {
      type: "pong",
      pong: 0,
    },
    [17, 0],
  ],
  [
    "pong with max safe integer",
    {
      type: "pong",
      pong: 9007199254740991, // Number.MAX_SAFE_INTEGER
    },
    [17, 255, 255, 255, 255, 255, 255, 255, 15],
  ],
];

describe("encode/decode pong", () => {
  test.each(cases)("%p", (name, message, expectedResult) => {
    const writer = new BufferWriter(16);
    encodePong(message, writer);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUInt8()).toEqual(PongMessageType);
    const decoded = decodePong(reader);
    expect(decoded).toEqual(message);
  });
});
