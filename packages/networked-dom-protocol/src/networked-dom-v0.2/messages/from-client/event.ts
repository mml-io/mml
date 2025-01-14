import { BufferReader } from "../../BufferReader";
import { BufferWriter } from "../../BufferWriter";
import { EventMessageType } from "../../messageTypes";

export type NetworkedDOMV02RemoteEvent = {
  type: "event";
  connectionId: number;
  nodeId: number;
  name: string;
  bubbles: boolean;
  params: any;
};

export function encodeEvent(event: NetworkedDOMV02RemoteEvent, writer: BufferWriter) {
  writer.writeUint8(EventMessageType);
  writer.writeUVarint(event.nodeId);
  writer.writeUVarint(event.connectionId);
  writer.writeLengthPrefixedString(event.name);
  writer.writeBoolean(event.bubbles);
  writer.writeLengthPrefixedString(JSON.stringify(event.params));
}

// Assumes that the first byte has already been read (the message type)
export function decodeEvent(buffer: BufferReader): NetworkedDOMV02RemoteEvent {
  const nodeId = buffer.readUVarint();
  const connectionId = buffer.readUVarint();
  const name = buffer.readUVarintPrefixedString();
  const bubbles = buffer.readBoolean();
  const paramsJSONString = buffer.readUVarintPrefixedString();
  const params = JSON.parse(paramsJSONString);
  return {
    type: "event",
    nodeId,
    connectionId,
    name,
    bubbles,
    params,
  };
}
