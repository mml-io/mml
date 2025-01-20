import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { decodeAttributes, encodeAttributes } from "../../common-structs/attributes";
import { AttributesChangedMessageType } from "../../messageTypes";

export type NetworkedDOMV02AttributesChangedDiff = {
  type: "attributesChanged";
  nodeId: number;
  attributes: Array<[string, string | null]>;
  documentTime?: number;
};

export function encodeAttributesChanged(
  msg: NetworkedDOMV02AttributesChangedDiff,
  writer: BufferWriter = new BufferWriter(64),
): BufferWriter {
  writer.writeUint8(AttributesChangedMessageType);
  writer.writeUVarint(msg.nodeId);
  encodeAttributes(writer, msg.attributes);
  return writer;
}

// Assumes that the first byte has already been read (the message type)
export function decodeAttributesChanged(
  buffer: BufferReader,
): NetworkedDOMV02AttributesChangedDiff {
  const nodeId = buffer.readUVarint();
  const attributes = decodeAttributes(buffer);
  return {
    type: "attributesChanged",
    nodeId,
    attributes,
  };
}
