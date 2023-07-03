import {
  FromObservableDOMInstanceMessage,
  ObservableDOMParameters,
  ToObservableDOMInstanceMessage,
} from "@mml-io/observable-dom-common";

export const CREATE_MESSAGE_TYPE = "create";
export const DISPOSE_MESSAGE_TYPE = "dispose";
export const INSTANCE_MESSAGE_TYPE = "instance";

export type CreateRemoteInstanceMessage = {
  type: typeof CREATE_MESSAGE_TYPE;
  instanceId: number;
  parameters: ObservableDOMParameters;
};

export type ToRemoteInstanceMessage = {
  type: typeof INSTANCE_MESSAGE_TYPE;
  instanceId: number;
  message: ToObservableDOMInstanceMessage;
};

export type DisposeRemoteInstanceMessage = {
  type: typeof DISPOSE_MESSAGE_TYPE;
  instanceId: number;
};

export type ToRemoteServerMessage =
  | CreateRemoteInstanceMessage
  | ToRemoteInstanceMessage
  | DisposeRemoteInstanceMessage;

export type FromRemoteInstanceMessage = {
  type: typeof INSTANCE_MESSAGE_TYPE;
  instanceId: number;
  message: FromObservableDOMInstanceMessage;
};

export type FromRemoteServerMessage = FromRemoteInstanceMessage;
