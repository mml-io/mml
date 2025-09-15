import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { BatchStartMessageType } from "../../messageTypes";
import {
  batchStartMessage,
  encodeBatchStart,
  NetworkedDOMV02BatchStartMessage,
} from "./batchStart";

const cases: Array<[string, NetworkedDOMV02BatchStartMessage, Array<number>]> = [
  ["batch start message", batchStartMessage, [2]],
];

describe("encode/decode batchStart", () => {
  test.each(cases)("%p", (name, message, expectedResult) => {
    const writer = new BufferWriter(16);
    encodeBatchStart(writer);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUInt8()).toEqual(BatchStartMessageType);
    // No decode function needed since batchStart has no data beyond the message type
    expect(message).toEqual(batchStartMessage);
  });
});
