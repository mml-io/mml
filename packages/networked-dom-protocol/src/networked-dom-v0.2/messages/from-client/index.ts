import { NetworkedDOMV02ConnectUsersMessage } from "./connectUsers";
import { NetworkedDOMV02DisconnectUsersMessage } from "./disconnectUsers";
import { NetworkedDOMV02RemoteEvent } from "./event";
import { NetworkedDOMV02PongMessage } from "./pong";

export * from "./connectUsers";
export * from "./disconnectUsers";
export * from "./event";
export * from "./pong";

export type NetworkedDOMV02ClientMessage =
  | NetworkedDOMV02ConnectUsersMessage
  | NetworkedDOMV02DisconnectUsersMessage
  | NetworkedDOMV02RemoteEvent
  | NetworkedDOMV02PongMessage;
