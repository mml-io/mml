import { BufferWriter } from "./BufferWriter";
import {
  encodeBatchEnd,
  encodeBatchStart,
  encodeTextChanged,
  NetworkedDOMV02ServerMessage,
} from "./messages";
import { encodeAttributesChanged } from "./messages/from-server/attributesChanged";
import { encodeChangeHiddenFrom } from "./messages/from-server/changeHiddenFrom";
import { encodeChangeVisibleTo } from "./messages/from-server/changeVisibleTo";
import { encodeChildrenAdded } from "./messages/from-server/childrenAdded";
import { encodeChildrenRemoved } from "./messages/from-server/childrenRemoved";
import { encodeDocumentTime } from "./messages/from-server/documentTime";
import { encodeError } from "./messages/from-server/error";
import { encodePing } from "./messages/from-server/ping";
import { encodeSnapshot } from "./messages/from-server/snapshot";
import { encodeWarning } from "./messages/from-server/warning";

export function encodeServerMessage(
  message: NetworkedDOMV02ServerMessage,
  writer?: BufferWriter,
): BufferWriter {
  switch (message.type) {
    case "snapshot":
      return encodeSnapshot(message, writer);
    case "documentTime":
      return encodeDocumentTime(message, writer);
    case "childrenAdded":
      return encodeChildrenAdded(message, writer);
    case "childrenRemoved":
      return encodeChildrenRemoved(message, writer);
    case "attributesChanged":
      return encodeAttributesChanged(message, writer);
    case "textChanged":
      return encodeTextChanged(message, writer);
    case "changeVisibleTo":
      return encodeChangeVisibleTo(message, writer);
    case "changeHiddenFrom":
      return encodeChangeHiddenFrom(message, writer);
    case "batchStart":
      return encodeBatchStart(writer);
    case "batchEnd":
      return encodeBatchEnd(writer);
    case "ping":
      return encodePing(message, writer);
    case "warning":
      return encodeWarning(message, writer);
    case "error":
      return encodeError(message, writer);
    default:
      throw new Error(`Unknown message type: ${(message as any).type}`);
  }
}
