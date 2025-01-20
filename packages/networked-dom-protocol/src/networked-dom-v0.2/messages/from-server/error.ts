import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { ErrorMessageType } from "../../messageTypes";

export type NetworkedDOMV02ErrorMessage = {
  type: "error";
  message: string;
};

export function encodeError(
  msg: NetworkedDOMV02ErrorMessage,
  writer: BufferWriter = new BufferWriter(64),
): BufferWriter {
  writer.writeUint8(ErrorMessageType);
  writer.writeLengthPrefixedString(msg.message);
  return writer;
}

// Assumes that the first byte has already been read (the message type)
export function decodeError(buffer: BufferReader): NetworkedDOMV02ErrorMessage {
  const message = buffer.readUVarintPrefixedString();
  return {
    type: "error",
    message,
  };
}
