import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import {
  decodeNodeDescription,
  encodeNodeDescription,
  NetworkedDOMV02NodeDescription,
} from "../../common-structs/nodeDescription";
import { ChildrenAddedMessageType } from "../../messageTypes";

export type NetworkedDOMV02ChildrenAddedDiff = {
  type: "childrenAdded";
  nodeId: number;
  previousNodeId: number | null;
  addedNodes: Array<NetworkedDOMV02NodeDescription>;
};

export function encodeChildrenAdded(
  msg: NetworkedDOMV02ChildrenAddedDiff,
  writer: BufferWriter = new BufferWriter(64),
): BufferWriter {
  writer.writeUint8(ChildrenAddedMessageType);
  writer.writeUVarint(msg.nodeId);
  writer.writeUVarint(msg.previousNodeId ?? 0);
  writer.writeUVarint(msg.addedNodes.length);
  for (let i = 0; i < msg.addedNodes.length; i++) {
    encodeNodeDescription(writer, msg.addedNodes[i]);
  }
  return writer;
}

// Assumes that the first byte has already been read (the message type)
export function decodeChildrenAdded(buffer: BufferReader): NetworkedDOMV02ChildrenAddedDiff {
  const nodeId = buffer.readUVarint();
  const previousNodeId = buffer.readUVarint();
  const childrenLength = buffer.readUVarint();
  const children: NetworkedDOMV02NodeDescription[] = [];
  for (let i = 0; i < childrenLength; i++) {
    children.push(decodeNodeDescription(buffer));
  }
  return {
    type: "childrenAdded",
    nodeId,
    previousNodeId: previousNodeId === 0 ? null : previousNodeId,
    addedNodes: children,
  };
}
