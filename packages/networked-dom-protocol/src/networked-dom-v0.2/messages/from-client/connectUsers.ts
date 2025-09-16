import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { networkedDOMProtocolSubProtocol_v0_2_SubversionNumber } from "../../constants";
import { protocolSubversionHasConnectionTokens } from "../../featureDetection";
import { ConnectUsersMessageType } from "../../messageTypes";

export type NetworkedDOMV02ConnectUsersMessage = {
  type: "connectUsers";
  connectionIds: Array<number>;
  // Enabled in networked-dom-v0.2.1 and above
  connectionTokens: Array<string | null>; // Optional tokens for each connection ID. On decoding empty string will be interpreted as null
};

export function encodeConnectUsers(
  connectUsersMessage: NetworkedDOMV02ConnectUsersMessage,
  writer: BufferWriter,
  protocolSubversion: networkedDOMProtocolSubProtocol_v0_2_SubversionNumber,
) {
  const connectionIdsLength = connectUsersMessage.connectionIds.length;
  writer.writeUint8(ConnectUsersMessageType);
  writer.writeUVarint(connectionIdsLength);
  for (let i = 0; i < connectionIdsLength; i++) {
    writer.writeUVarint(connectUsersMessage.connectionIds[i]);
  }
  if (protocolSubversionHasConnectionTokens(protocolSubversion)) {
    if (connectUsersMessage.connectionTokens.length !== connectionIdsLength) {
      throw new Error(
        `connectionTokens length (${connectUsersMessage.connectionTokens.length}) does not match connectionIds length (${connectionIdsLength})`,
      );
    }
    for (let i = 0; i < connectionIdsLength; i++) {
      const token = connectUsersMessage.connectionTokens[i];
      if (token === null || token === undefined) {
        writer.writeUVarint(0); // Length 0 means no token
      } else {
        writer.writeLengthPrefixedString(token);
      }
    }
  }
}

// Assumes that the first byte has already been read (the message type)
export function decodeConnectUsers(
  buffer: BufferReader,
  protocolSubversion: networkedDOMProtocolSubProtocol_v0_2_SubversionNumber,
): NetworkedDOMV02ConnectUsersMessage {
  const connectionIds: number[] = [];
  const connectionIdsLength = buffer.readUVarint();
  for (let i = 0; i < connectionIdsLength; i++) {
    connectionIds.push(buffer.readUVarint());
  }
  const connectionTokens: Array<string | null> = [];
  if (protocolSubversionHasConnectionTokens(protocolSubversion)) {
    for (let i = 0; i < connectionIdsLength; i++) {
      const token = buffer.readUVarintPrefixedString();
      if (token === "") {
        connectionTokens.push(null);
      } else {
        connectionTokens.push(token);
      }
    }
  } else {
    // This client doesn't support connection tokens, so fill with nulls for the server to interpret as "no token"
    for (let i = 0; i < connectionIdsLength; i++) {
      connectionTokens.push(null);
    }
  }
  return {
    type: "connectUsers",
    connectionIds,
    connectionTokens,
  };
}
