import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { ChildrenRemovedMessageType } from "../../messageTypes";

export type NetworkedDOMV02ChildrenRemovedDiff = {
  type: "childrenRemoved";
  nodeId: number;
  removedNodes: Array<number>;
  documentTime?: number;
};

export function encodeChildrenRemoved(
  msg: NetworkedDOMV02ChildrenRemovedDiff,
  writer: BufferWriter = new BufferWriter(64),
): BufferWriter {
  writer.writeUint8(ChildrenRemovedMessageType);
  writer.writeUVarint(msg.nodeId);
  writer.writeUVarint(msg.removedNodes.length);
  for (const nodeId of msg.removedNodes) {
    writer.writeUVarint(nodeId);
  }
  return writer;
}

// Assumes that the first byte has already been read (the message type)
export function decodeChildrenRemoved(buffer: BufferReader): NetworkedDOMV02ChildrenRemovedDiff {
  const nodeId = buffer.readUVarint();
  const removedNodesLength = buffer.readUVarint();
  const removedNodes: number[] = [];
  for (let i = 0; i < removedNodesLength; i++) {
    removedNodes.push(buffer.readUVarint());
  }
  return {
    type: "childrenRemoved",
    nodeId,
    removedNodes,
  };
}
