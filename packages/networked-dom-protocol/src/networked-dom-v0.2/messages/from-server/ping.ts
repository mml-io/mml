import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { PingMessageType } from "../../messageTypes";

export type NetworkedDOMV02PingMessage = {
  type: "ping";
  ping: number;
  documentTime: number;
};

export function encodePing(
  pingMessage: NetworkedDOMV02PingMessage,
  writer: BufferWriter = new BufferWriter(8),
): BufferWriter {
  writer.writeUint8(PingMessageType);
  writer.writeUVarint(pingMessage.ping);
  writer.writeUVarint(pingMessage.documentTime);
  return writer;
}

// Assumes that the first byte has already been read (the message type)
export function decodePing(buffer: BufferReader): NetworkedDOMV02PingMessage {
  const ping = buffer.readUVarint();
  const documentTime = buffer.readUVarint();
  return {
    type: "ping",
    ping,
    documentTime,
  };
}
