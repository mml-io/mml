import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { ChangeVisibleToMessageType } from "../../messageTypes";

export type NetworkedDOMV02ChangeVisibleToDiff = {
  type: "changeVisibleTo";
  nodeId: number;
  /*
   The semantics are that if there are no visibleTo limitations then the node is visible to everyone.

   It is advisable to apply the addVisibleTo first before the removeVisibleTo to avoid even a temporary state where a node is visible to everyone between the two operations.
  */
  addVisibleTo: Array<number>;
  removeVisibleTo: Array<number>;
};

export function encodeChangeVisibleTo(
  msg: NetworkedDOMV02ChangeVisibleToDiff,
  writer: BufferWriter = new BufferWriter(64),
): BufferWriter {
  writer.writeUint8(ChangeVisibleToMessageType);
  writer.writeUVarint(msg.nodeId);

  if (msg.addVisibleTo) {
    writer.writeUVarint(msg.addVisibleTo.length);

    for (const key of msg.addVisibleTo) {
      writer.writeUVarint(key);
    }
  } else {
    // If there are no addVisibleTo, we still need to send a 0 to indicate that there are no entries
    writer.writeUVarint(0);
  }
  if (msg.removeVisibleTo) {
    writer.writeUVarint(msg.removeVisibleTo.length);

    for (const key of msg.removeVisibleTo) {
      writer.writeUVarint(key);
    }
  } else {
    // If there are no removeVisibleTo, we still need to send a 0 to indicate that there are no entries
    writer.writeUVarint(0);
  }
  return writer;
}

// Assumes that the first byte has already been read (the message type)
export function decodeChangeVisibleTo(buffer: BufferReader): NetworkedDOMV02ChangeVisibleToDiff {
  const nodeId = buffer.readUVarint();
  const addVisibleToLength = buffer.readUVarint();
  const addVisibleTo: number[] = [];
  for (let i = 0; i < addVisibleToLength; i++) {
    addVisibleTo.push(buffer.readUVarint());
  }

  const removeVisibleToLength = buffer.readUVarint();
  const removeVisibleTo: number[] = [];
  for (let i = 0; i < removeVisibleToLength; i++) {
    removeVisibleTo.push(buffer.readUVarint());
  }

  return {
    type: "changeVisibleTo",
    nodeId,
    addVisibleTo,
    removeVisibleTo,
  };
}
