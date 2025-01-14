import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import {
  decodeNodeDescription,
  encodeNodeDescription,
  NetworkedDOMV02ElementNodeDescription,
  NetworkedDOMV02NodeDescription,
} from "../../common-structs/nodeDescription";
import { SnapshotMessageType } from "../../messageTypes";

export type NetworkedDOMV02SnapshotMessage = {
  type: "snapshot";
  snapshot: NetworkedDOMV02NodeDescription;
  documentTime: number;
};

export function encodeSnapshot(
  msg: NetworkedDOMV02SnapshotMessage,
  writer: BufferWriter = new BufferWriter(64),
): BufferWriter {
  writer.writeUint8(SnapshotMessageType);
  encodeNodeDescription(writer, msg.snapshot as NetworkedDOMV02ElementNodeDescription);
  writer.writeUVarint(msg.documentTime);
  return writer;
}

// Assumes that the first byte has already been read (the message type)
export function decodeSnapshot(buffer: BufferReader): NetworkedDOMV02SnapshotMessage {
  return {
    type: "snapshot",
    snapshot: decodeNodeDescription(buffer),
    documentTime: buffer.readUVarint(),
  };
}
