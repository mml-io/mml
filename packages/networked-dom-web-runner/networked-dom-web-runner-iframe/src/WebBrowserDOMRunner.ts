import { RemoteEvent } from "@mml-io/networked-dom-protocol";
import { DOMRunnerFactory, DOMRunnerInterface, DOMRunnerMessage } from "@mml-io/observable-dom";

export const WebBrowserDOMRunnerFactory: DOMRunnerFactory = (
  htmlPath: string,
  htmlContents: string,
  params: object,
  callback: (mutationList: DOMRunnerMessage) => void,
): DOMRunnerInterface => {
  return new WebBrowserDOMRunner(htmlPath, htmlContents, params, callback);
};

const documentLoadTime = Date.now();

export class WebBrowserDOMRunner implements DOMRunnerInterface {
  private mutationObserver: MutationObserver;
  private htmlPath: string;
  private callback: (domRunnerMessage: DOMRunnerMessage) => void;

  constructor(
    htmlPath: string,
    htmlContents: string,
    params: object,
    callback: (domRunnerMessage: DOMRunnerMessage) => void,
  ) {
    this.htmlPath = htmlPath;
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
          content: {
            message,
            type: error?.name,
            line,
            column,
          },
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

  addIPCWebsocket(): void {
    throw new Error("Not implemented.");
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

    // Dispatch the event via JavaScript.
    realElement.dispatchEvent(remoteEventObject);
  }

  dispose(): void {
    // TODO - handle dispose
    console.log("WebBrowserDOMRunner.dispose");
  }

  getDocument(): Document {
    return document;
  }

  getDocumentTime(): number {
    if (document.timeline && document.timeline.currentTime) {
      return document.timeline.currentTime;
    }
    return Date.now() - documentLoadTime;
  }

  // TODO - resolve types (Window needs to expose classes such as CustomEvent as properties)
  getWindow(): any {
    return window;
  }
}
