import { RemoteEvent } from "@mml-io/networked-dom-protocol";
import { DOMRunnerFactory, DOMRunnerInterface, DOMRunnerMessage } from "@mml-io/observable-dom";

export const WebBrowserDOMRunnerFactory: DOMRunnerFactory = (
  htmlPath: string,
  htmlContents: string,
  params: object,
  callback: (mutationList: DOMRunnerMessage) => void,
): DOMRunnerInterface => {
  return new WebBrowserDOMRunner(params, callback);
};

let documentLoadTime = Date.now();
if (document.timeline && document.timeline.currentTime) {
  documentLoadTime = Date.now() - (document.timeline.currentTime as number);
}

/**
 * WebBrowserDOMRunner is a DOMRunnerInterface implementation that runs in a web browser. It is intended to be run in
 * an iframe and the parent window is expected to send messages to it to dispatch events and to receive mutation
 * messages.
 *
 * It is expected that the document contents is injected immediately after this class is instantiated.
 */
export class WebBrowserDOMRunner implements DOMRunnerInterface {
  private mutationObserver: MutationObserver;
  private callback: (domRunnerMessage: DOMRunnerMessage) => void;

  constructor(params: object, callback: (domRunnerMessage: DOMRunnerMessage) => void) {
    this.callback = callback;

    // Forward console messages
    for (const level of ["error", "warn", "info", "log"] as const) {
      const defaultFn = window.console[level];

      window.console[level] = (...args) => {
        callback({
          logMessage: {
            level,
            content: args,
          },
        });
        defaultFn(...args);
      };
    }

    // Forward uncaught errors
    window.onerror = (message, source, line, column, error) => {
      callback({
        logMessage: {
          level: "system",
          content: [
            {
              message,
              type: error?.name,
              line,
              column,
            },
          ],
        },
      });
      return false;
    };

    let didSendLoad = false;

    this.mutationObserver = new window.MutationObserver((mutationList) => {
      if (!document) {
        return;
      }
      if (!didSendLoad) {
        throw new Error("MutationObserver called before load");
      }
      this.callback({
        mutationList,
      });
    });

    (window as any).params = params;

    const finishLoad = () => {
      if (didSendLoad) {
        throw new Error("finishLoad called twice");
      }
      didSendLoad = true;
      this.callback({
        loaded: true,
      });
      this.mutationObserver.observe(window.document, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true,
      });
    };
    if (document.body) {
      setTimeout(finishLoad, 0);
    } else {
      window.addEventListener("DOMContentLoaded", finishLoad);
    }
  }

  dispatchRemoteEventFromConnectionId(
    connectionId: number,
    realElement: Element,
    remoteEvent: RemoteEvent,
  ): void {
    const bubbles = remoteEvent.bubbles || false;
    const remoteEventObject = new CustomEvent(remoteEvent.name, {
      bubbles,
      detail: { ...remoteEvent.params, connectionId },
    });

    const eventTypeLowerCase = remoteEvent.name.toLowerCase();

    // TODO - check if there are other events that automatically wire up similarly to click->onclick and avoid those too
    if (eventTypeLowerCase !== "click") {
      const handlerAttributeName = "on" + eventTypeLowerCase;
      const handlerAttributeValue = realElement.getAttribute(handlerAttributeName);
      if (handlerAttributeValue) {
        // This event is defined as an HTML event attribute.
        try {
          const fn = Function("event", handlerAttributeValue);
          fn.apply(realElement, [remoteEventObject]);
        } catch (e) {
          console.error("Error running event handler:", e);
        }
      }
    }

    // Dispatch the event via JavaScript.
    realElement.dispatchEvent(remoteEventObject);
  }

  dispose(): void {
    // TODO - handle dispose
  }

  getDocument(): Document {
    return document;
  }

  getDocumentTime(): number {
    const dateBasedDocumentTime = Date.now() - documentLoadTime;
    if (document.timeline && document.timeline.currentTime) {
      const time = document.timeline.currentTime as number;
      if (dateBasedDocumentTime > time + 500) {
        // The timeline can be "left behind" if the tab is backgrounded for a while, so we use the date-based time
        // instead. If/when the document is brought back into the foreground, the timeline will catch up.
        return dateBasedDocumentTime;
      }
      // Ideal case - use the document.timeline as it's what is available to the document script
      return time;
    }
    return dateBasedDocumentTime;
  }

  // TODO - resolve types (Window needs to expose classes such as CustomEvent as properties)
  getWindow(): any {
    return window;
  }
}
