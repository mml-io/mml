import { ObservableDOM } from "@mml-io/observable-dom/src/ObservableDOM";
import {
  ADD_CONNECTED_USER_ID_MESSAGE_TYPE,
  DISPATCH_REMOTE_EVENT_FROM_CONNECTION_ID_MESSAGE_TYPE,
  DOM_MESSAGE_TYPE,
  FromObservableDOMInstanceMessage,
  ObservableDOMMessage,
  ObservableDOMParameters,
  REMOVE_CONNECTED_USER_ID_MESSAGE_TYPE,
  ToObservableDOMInstanceMessage,
} from "@mml-io/observable-dom-common";

import { WebBrowserDOMRunnerFactory } from "./WebBrowserDOMRunner";

// This runs in the iframe that will execute the document script to setup the listening for events messages
export function setupIframeWebRunner(argsString: string) {
  const observableDOMParams = JSON.parse(atob(argsString)) as ObservableDOMParameters;

  const sendMessageToHandler = (message: FromObservableDOMInstanceMessage) => {
    window.parent.postMessage(JSON.stringify(message), "*");
  };

  const observableDOM = new ObservableDOM(
    {
      ...observableDOMParams,
      htmlContents: "", // This must be empty as the contents are assumed to be provided by the srcdoc
    },
    (observableDOMMessage: ObservableDOMMessage) => {
      sendMessageToHandler({
        type: DOM_MESSAGE_TYPE,
        message: observableDOMMessage,
      });
    },
    WebBrowserDOMRunnerFactory,
  );

  window.addEventListener("message", (e) => {
    const parsed = JSON.parse(e.data) as ToObservableDOMInstanceMessage;
    switch (parsed.type) {
      case DISPATCH_REMOTE_EVENT_FROM_CONNECTION_ID_MESSAGE_TYPE:
        observableDOM.dispatchRemoteEventFromConnectionId(parsed.connectionId, parsed.event);
        break;
      case ADD_CONNECTED_USER_ID_MESSAGE_TYPE:
        observableDOM.addConnectedUserId(parsed.connectionId);
        break;
      case REMOVE_CONNECTED_USER_ID_MESSAGE_TYPE:
        observableDOM.removeConnectedUserId(parsed.connectionId);
        break;
      default:
        console.error("Unknown message type", parsed);
    }
  });
}
