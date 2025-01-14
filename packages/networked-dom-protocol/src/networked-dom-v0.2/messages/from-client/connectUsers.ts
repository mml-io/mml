import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { ConnectUsersMessageType } from "../../messageTypes";

export type NetworkedDOMV02ConnectUsersMessage = {
  type: "connectUsers";
  connectionIds: Array<number>;
};

export function encodeConnectUsers(
  connectUsersMessage: NetworkedDOMV02ConnectUsersMessage,
  writer: BufferWriter,
) {
  const connectionIdsLength = connectUsersMessage.connectionIds.length;
  writer.writeUint8(ConnectUsersMessageType);
  writer.writeUVarint(connectionIdsLength);
  for (let i = 0; i < connectionIdsLength; i++) {
    writer.writeUVarint(connectUsersMessage.connectionIds[i]);
  }
}

// Assumes that the first byte has already been read (the message type)
export function decodeConnectUsers(buffer: BufferReader): NetworkedDOMV02ConnectUsersMessage {
  const connectionIds: number[] = [];
  const connectionIdsLength = buffer.readUVarint();
  for (let i = 0; i < connectionIdsLength; i++) {
    connectionIds.push(buffer.readUVarint());
  }
  return {
    type: "connectUsers",
    connectionIds,
  };
}
