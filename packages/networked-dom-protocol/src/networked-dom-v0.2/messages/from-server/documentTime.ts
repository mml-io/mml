import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { DocumentTimeMessageType } from "../../messageTypes";

export type NetworkedDOMV02DocumentTimeMessage = {
  type: "documentTime";
  documentTime: number;
};

export function encodeDocumentTime(
  msg: NetworkedDOMV02DocumentTimeMessage,
  writer: BufferWriter = new BufferWriter(8),
): BufferWriter {
  writer.writeUint8(DocumentTimeMessageType);
  writer.writeUVarint(msg.documentTime);
  return writer;
}

// Assumes that the first byte has already been read (the message type)
export function decodeDocumentTime(buffer: BufferReader): NetworkedDOMV02DocumentTimeMessage {
  return {
    type: "documentTime",
    documentTime: buffer.readUVarint(),
  };
}
