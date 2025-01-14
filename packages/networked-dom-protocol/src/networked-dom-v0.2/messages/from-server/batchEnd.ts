import { BufferWriter } from "../../BufferWriter";
import { BatchEndMessageType } from "../../messageTypes";

export type NetworkedDOMV02BatchEndMessage = {
  type: "batchEnd";
};

export function encodeBatchEnd(writer: BufferWriter = new BufferWriter(1)): BufferWriter {
  writer.writeUint8(BatchEndMessageType);
  return writer;
}

export const batchEndMessage: NetworkedDOMV02BatchEndMessage = {
  type: "batchEnd",
};
