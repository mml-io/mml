import {
  FromInstanceMessageTypes,
  ToInstanceMessageTypes,
} from "@mml-io/networked-dom-web-runner/src/message-types";
import { ObservableDom } from "@mml-io/observable-dom/src/ObservableDom";
import { ObservableDomMessage, ObservableDOMParameters } from "@mml-io/observable-dom-common";

import { WebBrowserDOMRunnerFactory } from "./WebBrowserDOMRunner";

// This runs in the iframe that will execute the document script to setup the listening for events messages
export function setupIframeWebRunner(argsString: string) {
  const observableDOMParams = JSON.parse(atob(argsString)) as ObservableDOMParameters;

  const sendMessageToHandler = (message: FromInstanceMessageTypes) => {
    window.parent.postMessage(JSON.stringify(message), "*");
  };

  const observableDOM = new ObservableDom(
    {
      ...observableDOMParams,
      htmlContents: "", // This must be empty as the contents are assumed to be provided by the srcdoc
    },
    (observableDomMessage: ObservableDomMessage) => {
      sendMessageToHandler({
        type: "dom",
        message: observableDomMessage,
      });
    },
    WebBrowserDOMRunnerFactory,
  );

  window.addEventListener("message", (e) => {
    const parsed = JSON.parse(e.data) as ToInstanceMessageTypes;
    if (parsed.type === "dispatchRemoteEventFromConnectionId") {
      observableDOM.dispatchRemoteEventFromConnectionId(parsed.connectionId, parsed.event);
    }
  });
}
