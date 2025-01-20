import {
  ObservableDOMInterface,
  ObservableDOMMessage,
  ObservableDOMRemoteEvent,
} from "./ObservableDOMInterface";

export const ADD_CONNECTED_USER_ID_MESSAGE_TYPE = "addConnectedUserId";
export const REMOVE_CONNECTED_USER_ID_MESSAGE_TYPE = "removeConnectedUserId";
export const DISPATCH_REMOTE_EVENT_FROM_CONNECTION_ID_MESSAGE_TYPE =
  "dispatchRemoteEventFromConnectionId";
export const DOM_MESSAGE_TYPE = "dom";

export type AddConnectedUserIdMessage = {
  type: typeof ADD_CONNECTED_USER_ID_MESSAGE_TYPE;
  connectionId: number;
};

export type RemoveConnectedUserIdMessage = {
  type: typeof REMOVE_CONNECTED_USER_ID_MESSAGE_TYPE;
  connectionId: number;
};

export type DispatchRemoteEventFromConnectionIdMessage = {
  type: typeof DISPATCH_REMOTE_EVENT_FROM_CONNECTION_ID_MESSAGE_TYPE;
  connectionId: number;
  event: ObservableDOMRemoteEvent;
};

export type ToObservableDOMInstanceMessage =
  | AddConnectedUserIdMessage
  | RemoveConnectedUserIdMessage
  | DispatchRemoteEventFromConnectionIdMessage;

type DOMMessage = {
  type: typeof DOM_MESSAGE_TYPE;
  message: ObservableDOMMessage;
};

export type FromObservableDOMInstanceMessage = DOMMessage;

export function applyMessageToObservableDOMInstance(
  message: ToObservableDOMInstanceMessage,
  instance: ObservableDOMInterface,
) {
  if (message.type === ADD_CONNECTED_USER_ID_MESSAGE_TYPE) {
    instance.addConnectedUserId(message.connectionId);
  } else if (message.type === REMOVE_CONNECTED_USER_ID_MESSAGE_TYPE) {
    instance.removeConnectedUserId(message.connectionId);
  } else if (message.type === DISPATCH_REMOTE_EVENT_FROM_CONNECTION_ID_MESSAGE_TYPE) {
    instance.dispatchRemoteEventFromConnectionId(message.connectionId, message.event);
  } else {
    console.error("Unknown message type", message);
  }
}

export function observableDOMInterfaceToMessageSender(
  sender: (message: ToObservableDOMInstanceMessage) => void,
  dispose: () => void,
) {
  const remoteObservableDOM: ObservableDOMInterface = {
    addConnectedUserId(connectionId: number): void {
      sender({
        type: ADD_CONNECTED_USER_ID_MESSAGE_TYPE,
        connectionId,
      });
    },
    dispatchRemoteEventFromConnectionId(
      connectionId: number,
      remoteEvent: ObservableDOMRemoteEvent,
    ): void {
      sender({
        type: DISPATCH_REMOTE_EVENT_FROM_CONNECTION_ID_MESSAGE_TYPE,
        connectionId,
        event: remoteEvent,
      });
    },
    dispose(): void {
      dispose();
    },
    removeConnectedUserId(connectionId: number): void {
      sender({
        type: REMOVE_CONNECTED_USER_ID_MESSAGE_TYPE,
        connectionId,
      });
    },
  };
  return remoteObservableDOM;
}
