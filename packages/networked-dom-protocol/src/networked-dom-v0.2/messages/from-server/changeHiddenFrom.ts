import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { ChangeHiddenFromMessageType } from "../../messageTypes";

export type NetworkedDOMV02ChangeHiddenFromDiff = {
  type: "changeHiddenFrom";
  nodeId: number;
  addHiddenFrom: Array<number>;
  removeHiddenFrom: Array<number>;
};

export function encodeChangeHiddenFrom(
  msg: NetworkedDOMV02ChangeHiddenFromDiff,
  writer: BufferWriter = new BufferWriter(64),
): BufferWriter {
  writer.writeUint8(ChangeHiddenFromMessageType);
  writer.writeUVarint(msg.nodeId);

  if (msg.addHiddenFrom) {
    writer.writeUVarint(msg.addHiddenFrom.length);

    for (const key of msg.addHiddenFrom) {
      writer.writeUVarint(key);
    }
  } else {
    // If there are no addHiddenFrom, we still need to send a 0 to indicate that there are no entries
    writer.writeUVarint(0);
  }
  if (msg.removeHiddenFrom) {
    writer.writeUVarint(msg.removeHiddenFrom.length);

    for (const key of msg.removeHiddenFrom) {
      writer.writeUVarint(key);
    }
  } else {
    // If there are no removeHiddenFrom, we still need to send a 0 to indicate that there are no entries
    writer.writeUVarint(0);
  }
  return writer;
}

// Assumes that the first byte has already been read (the message type)
export function decodeChangeHiddenFrom(buffer: BufferReader): NetworkedDOMV02ChangeHiddenFromDiff {
  const nodeId = buffer.readUVarint();
  const addHiddenFromLength = buffer.readUVarint();
  const addHiddenFrom: number[] = [];
  for (let i = 0; i < addHiddenFromLength; i++) {
    addHiddenFrom.push(buffer.readUVarint());
  }

  const removeHiddenFromLength = buffer.readUVarint();
  const removeHiddenFrom: number[] = [];
  for (let i = 0; i < removeHiddenFromLength; i++) {
    removeHiddenFrom.push(buffer.readUVarint());
  }

  return {
    type: "changeHiddenFrom",
    nodeId,
    addHiddenFrom,
    removeHiddenFrom,
  };
}
