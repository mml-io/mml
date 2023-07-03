import { ObservableDOMFactory } from "@mml-io/networked-dom-document";
import {
  DOM_MESSAGE_TYPE,
  FromObservableDOMInstanceMessage,
  ObservableDOMInterface,
  observableDOMInterfaceToMessageSender,
  ObservableDOMMessage,
  ObservableDOMParameters,
  ToObservableDOMInstanceMessage,
} from "@mml-io/observable-dom-common";

import { RunnerIframe } from "./RunnerIframe";

export const IframeObservableDOMFactory: ObservableDOMFactory = (
  observableDOMParameters: ObservableDOMParameters,
  callback: (message: ObservableDOMMessage, observableDOM: ObservableDOMInterface) => void,
) => {
  const runnerIframe = new RunnerIframe(
    observableDOMParameters,
    (message: FromObservableDOMInstanceMessage) => {
      switch (message.type) {
        case DOM_MESSAGE_TYPE:
          callback(message.message, remoteObservableDOM);
          break;
        default:
          console.error("Unknown message type", message.type);
      }
    },
  );

  const remoteObservableDOM: ObservableDOMInterface = observableDOMInterfaceToMessageSender(
    (message: ToObservableDOMInstanceMessage) => {
      runnerIframe.sendMessageToRunner(message);
    },
    () => {
      runnerIframe.dispose();
    },
  );
  return remoteObservableDOM;
};
