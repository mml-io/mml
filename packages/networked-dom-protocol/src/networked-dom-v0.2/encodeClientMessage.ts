import { BufferWriter } from "./BufferWriter";
import {
  encodeConnectUsers,
  encodeDisconnectUsers,
  encodeEvent,
  encodePong,
  NetworkedDOMV02ClientMessage,
} from "./messages";

export function encodeClientMessage(message: NetworkedDOMV02ClientMessage, writer: BufferWriter) {
  const type = message.type;
  switch (type) {
    case "connectUsers":
      return encodeConnectUsers(message, writer);
    case "disconnectUsers":
      return encodeDisconnectUsers(message, writer);
    case "event":
      return encodeEvent(message, writer);
    case "pong":
      return encodePong(message, writer);
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}
