import { BufferReader } from "./BufferReader";
import { NetworkedDOMV02ClientMessage } from "./messages";
import { decodeConnectUsers } from "./messages/from-client/connectUsers";
import { decodeDisconnectUsers } from "./messages/from-client/disconnectUsers";
import { decodeEvent } from "./messages/from-client/event";
import { decodePong } from "./messages/from-client/pong";
import {
  ConnectUsersMessageType,
  DisconnectUsersMessageType,
  EventMessageType,
  PongMessageType,
} from "./messageTypes";

export function decodeClientMessages(buffer: BufferReader): Array<NetworkedDOMV02ClientMessage> {
  const messages: NetworkedDOMV02ClientMessage[] = [];
  while (!buffer.isEnd()) {
    const messageType = buffer.readUInt8();
    switch (messageType) {
      case ConnectUsersMessageType:
        messages.push(decodeConnectUsers(buffer));
        break;
      case DisconnectUsersMessageType:
        messages.push(decodeDisconnectUsers(buffer));
        break;
      case EventMessageType:
        messages.push(decodeEvent(buffer));
        break;
      case PongMessageType:
        messages.push(decodePong(buffer));
        break;
      default:
        throw new Error(`Unknown message type: ${messageType}`);
    }
  }
  return messages;
}
