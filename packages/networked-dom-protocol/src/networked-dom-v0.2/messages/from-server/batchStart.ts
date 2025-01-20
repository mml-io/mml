import { BufferWriter } from "../../BufferWriter";
import { BatchStartMessageType } from "../../messageTypes";

export type NetworkedDOMV02BatchStartMessage = {
  type: "batchStart";
};

export function encodeBatchStart(writer: BufferWriter = new BufferWriter(1)): BufferWriter {
  writer.writeUint8(BatchStartMessageType);
  return writer;
}

export const batchStartMessage: NetworkedDOMV02BatchStartMessage = {
  type: "batchStart",
};
