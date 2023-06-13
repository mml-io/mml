import { RemoteEvent } from "@mml-io/networked-dom-protocol";
import { ObservableDomMessage } from "@mml-io/observable-dom-common";

export type AddConnectedUserIdMessage = {
  type: "addConnectedUserId";
  connectionId: number;
};

export type RemoveConnectedUserIdMessage = {
  type: "removeConnectedUserId";
  connectionId: number;
};

export type DispatchRemoteEventFromConnectionIdMessage = {
  type: "dispatchRemoteEventFromConnectionId";
  connectionId: number;
  event: RemoteEvent;
};

export type ToInstanceMessageTypes =
  | AddConnectedUserIdMessage
  | RemoveConnectedUserIdMessage
  | DispatchRemoteEventFromConnectionIdMessage;

type DOMMessage = {
  type: "dom";
  message: ObservableDomMessage;
};

export type FromInstanceMessageTypes = DOMMessage;
