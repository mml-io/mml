import { BufferReader } from "./BufferReader";
import {
  batchEndMessage,
  batchStartMessage,
  decodeAttributesChanged,
  decodeChangeHiddenFrom,
  decodeChangeVisibleTo,
  decodeChildrenAdded,
  decodeChildrenRemoved,
  decodeError,
  decodePing,
  decodeSnapshot,
  decodeTextChanged,
  decodeWarning,
  NetworkedDOMV02ServerMessage,
} from "./messages";
import { decodeDocumentTime } from "./messages/from-server/documentTime";
import {
  AttributesChangedMessageType,
  BatchEndMessageType,
  BatchStartMessageType,
  ChangeHiddenFromMessageType,
  ChangeVisibleToMessageType,
  ChildrenAddedMessageType,
  ChildrenRemovedMessageType,
  DocumentTimeMessageType,
  ErrorMessageType,
  PingMessageType,
  SnapshotMessageType,
  TextChangedMessageType,
  WarningMessageType,
} from "./messageTypes";

export function decodeServerMessages(buffer: BufferReader): Array<NetworkedDOMV02ServerMessage> {
  const messages: NetworkedDOMV02ServerMessage[] = [];
  while (!buffer.isEnd()) {
    const messageType = buffer.readUInt8();
    switch (messageType) {
      case SnapshotMessageType:
        messages.push(decodeSnapshot(buffer));
        break;
      case DocumentTimeMessageType:
        messages.push(decodeDocumentTime(buffer));
        break;
      case ChildrenAddedMessageType:
        messages.push(decodeChildrenAdded(buffer));
        break;
      case ChildrenRemovedMessageType:
        messages.push(decodeChildrenRemoved(buffer));
        break;
      case AttributesChangedMessageType:
        messages.push(decodeAttributesChanged(buffer));
        break;
      case TextChangedMessageType:
        messages.push(decodeTextChanged(buffer));
        break;
      case ChangeVisibleToMessageType:
        messages.push(decodeChangeVisibleTo(buffer));
        break;
      case ChangeHiddenFromMessageType:
        messages.push(decodeChangeHiddenFrom(buffer));
        break;
      case BatchStartMessageType:
        messages.push(batchStartMessage);
        break;
      case BatchEndMessageType:
        messages.push(batchEndMessage);
        break;
      case PingMessageType:
        messages.push(decodePing(buffer));
        break;
      case WarningMessageType:
        messages.push(decodeWarning(buffer));
        break;
      case ErrorMessageType:
        messages.push(decodeError(buffer));
        break;
      default:
        throw new Error(`Unknown message type: ${messageType}`);
    }
  }
  return messages;
}
