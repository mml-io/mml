import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { BatchEndMessageType } from "../../messageTypes";
import { batchEndMessage, encodeBatchEnd, NetworkedDOMV02BatchEndMessage } from "./batchEnd";

const cases: Array<[string, NetworkedDOMV02BatchEndMessage, Array<number>]> = [
  ["batch end message", batchEndMessage, [10]],
];

describe("encode/decode batchEnd", () => {
  test.each(cases)("%p", (name, message, expectedResult) => {
    const writer = new BufferWriter(16);
    encodeBatchEnd(writer);
    const encoded = writer.getBuffer();
    expect(Array.from(encoded)).toEqual(expectedResult);
    const reader = new BufferReader(encoded);
    expect(reader.readUInt8()).toEqual(BatchEndMessageType);
    // No decode function needed since batchEnd has no data beyond the message type
    expect(message).toEqual(batchEndMessage);
  });
});
