import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { DisconnectUsersMessageType } from "../../messageTypes";

export type NetworkedDOMV02DisconnectUsersMessage = {
  type: "disconnectUsers";
  connectionIds: Array<number>;
};

export function encodeDisconnectUsers(
  disconnectUsersMessage: NetworkedDOMV02DisconnectUsersMessage,
  writer: BufferWriter,
) {
  const connectionIdsLength = disconnectUsersMessage.connectionIds.length;
  writer.writeUint8(DisconnectUsersMessageType);
  writer.writeUVarint(connectionIdsLength);
  for (let i = 0; i < connectionIdsLength; i++) {
    writer.writeUVarint(disconnectUsersMessage.connectionIds[i]);
  }
}

// Assumes that the first byte has already been read (the message type)
export function decodeDisconnectUsers(buffer: BufferReader): NetworkedDOMV02DisconnectUsersMessage {
  const connectionIds: number[] = [];
  const connectionIdsLength = buffer.readUVarint();
  for (let i = 0; i < connectionIdsLength; i++) {
    connectionIds.push(buffer.readUVarint());
  }
  return {
    type: "disconnectUsers",
    connectionIds,
  };
}
