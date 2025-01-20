import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { TextChangedMessageType } from "../../messageTypes";

export type NetworkedDOMV02TextChangedDiff = {
  type: "textChanged";
  nodeId: number;
  text: string;
};

export function encodeTextChanged(
  msg: NetworkedDOMV02TextChangedDiff,
  writer: BufferWriter = new BufferWriter(64),
): BufferWriter {
  writer.writeUint8(TextChangedMessageType);
  writer.writeUVarint(msg.nodeId);
  writer.writeLengthPrefixedString(msg.text);
  return writer;
}

// Assumes that the first byte has already been read (the message type)
export function decodeTextChanged(buffer: BufferReader): NetworkedDOMV02TextChangedDiff {
  const nodeId = buffer.readUVarint();
  const text = buffer.readUVarintPrefixedString();
  return {
    type: "textChanged",
    nodeId,
    text,
  };
}
