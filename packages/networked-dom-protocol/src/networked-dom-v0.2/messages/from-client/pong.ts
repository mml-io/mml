import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { PongMessageType } from "../../messageTypes";

export type NetworkedDOMV02PongMessage = {
  type: "pong";
  pong: number;
};

export function encodePong(pongMessage: NetworkedDOMV02PongMessage, writer: BufferWriter) {
  writer.writeUint8(PongMessageType);
  writer.writeUVarint(pongMessage.pong);
}

// Assumes that the first byte has already been read (the message type)
export function decodePong(buffer: BufferReader): NetworkedDOMV02PongMessage {
  const pong = buffer.readUVarint();
  return {
    type: "pong",
    pong,
  };
}
