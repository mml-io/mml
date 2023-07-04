import {
  FromObservableDOMInstanceMessage,
  ToObservableDOMInstanceMessage,
} from "@mml-io/observable-dom-common";

export const INSTANCE_MESSAGE_TYPE = "instance";

export type FromBroadcastInstanceMessage = {
  type: typeof INSTANCE_MESSAGE_TYPE;
  revisionId: number;
  message: FromObservableDOMInstanceMessage;
};

export type ToBroadcastInstanceMessage = {
  type: typeof INSTANCE_MESSAGE_TYPE;
  revisionId: number;
  message: ToObservableDOMInstanceMessage;
};
