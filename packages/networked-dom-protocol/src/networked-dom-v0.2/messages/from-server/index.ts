import { NetworkedDOMV02AttributesChangedDiff } from "./attributesChanged";
import { NetworkedDOMV02BatchEndMessage } from "./batchEnd";
import { NetworkedDOMV02BatchStartMessage } from "./batchStart";
import { NetworkedDOMV02ChangeHiddenFromDiff } from "./changeHiddenFrom";
import { NetworkedDOMV02ChangeVisibleToDiff } from "./changeVisibleTo";
import { NetworkedDOMV02ChildrenAddedDiff } from "./childrenAdded";
import { NetworkedDOMV02ChildrenRemovedDiff } from "./childrenRemoved";
import { NetworkedDOMV02DocumentTimeMessage } from "./documentTime";
import { NetworkedDOMV02ErrorMessage } from "./error";
import { NetworkedDOMV02PingMessage } from "./ping";
import { NetworkedDOMV02SnapshotMessage } from "./snapshot";
import { NetworkedDOMV02TextChangedDiff } from "./textChanged";
import { NetworkedDOMV02WarningMessage } from "./warning";

export * from "./attributesChanged";
export * from "./batchEnd";
export * from "./batchStart";
export * from "./changeHiddenFrom";
export * from "./changeVisibleTo";
export * from "./childrenAdded";
export * from "./childrenRemoved";
export * from "./documentTime";
export * from "./error";
export * from "./index";
export * from "./ping";
export * from "./snapshot";
export * from "./textChanged";
export * from "./warning";

export type NetworkedDOMV02Diff =
  | NetworkedDOMV02SnapshotMessage
  | NetworkedDOMV02DocumentTimeMessage
  | NetworkedDOMV02ChildrenAddedDiff
  | NetworkedDOMV02ChildrenRemovedDiff
  | NetworkedDOMV02AttributesChangedDiff
  | NetworkedDOMV02TextChangedDiff
  | NetworkedDOMV02ChangeVisibleToDiff
  | NetworkedDOMV02ChangeHiddenFromDiff;

export type NetworkedDOMV02ServerMessage =
  | NetworkedDOMV02BatchStartMessage
  | NetworkedDOMV02Diff
  | NetworkedDOMV02BatchEndMessage
  | NetworkedDOMV02PingMessage
  | NetworkedDOMV02ErrorMessage
  | NetworkedDOMV02WarningMessage;
