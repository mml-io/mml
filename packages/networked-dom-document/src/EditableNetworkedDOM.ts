import { LogMessage, StaticVirtualDOMElement } from "@mml-io/observable-dom-common";

import { createNetworkedDOMConnectionForWebsocket } from "./createNetworkedDOMConnectionForWebsocket";
import { VirtualDOMDiffStruct } from "./diffing/calculateStaticVirtualDOMDiff";
import { NetworkedDOM, ObservableDOMFactory } from "./NetworkedDOM";
import { NetworkedDOMV01Connection } from "./NetworkedDOMV01Connection";
import { NetworkedDOMV02Connection } from "./NetworkedDOMV02Connection";

enum NetworkedDOMState {
  DocumentLoading,
  DocumentLoaded,
  BeforeDocumentLoaded,
}

type LoadedState =
  | {
      type: NetworkedDOMState.DocumentLoaded;
      htmlContents: string;
      networkedDOM: NetworkedDOM;
    }
  | {
      type: NetworkedDOMState.DocumentLoading;
      htmlContents: string;
      networkedDOM: NetworkedDOM;
    }
  | {
      type: NetworkedDOMState.BeforeDocumentLoaded;
    };

/**
 * EditableNetworkedDOM wraps NetworkedDOM instances and presents them as a single document that can iterate through
 * revisions by being loaded multiple times with different contents. The connected clients receive deltas between the
 * revisions rather than a complete refresh.
 */
export class EditableNetworkedDOM {
  private htmlPath: string;
  private params: object = {};

  private websockets = new Map<WebSocket, NetworkedDOMV01Connection | NetworkedDOMV02Connection>();
  private loadedState: LoadedState = {
    type: NetworkedDOMState.BeforeDocumentLoaded,
  };

  private observableDOMFactory: ObservableDOMFactory;
  private ignoreTextNodes: boolean;

  private logCallback?: (message: LogMessage) => void;

  constructor(
    htmlPath: string,
    observableDOMFactory: ObservableDOMFactory,
    ignoreTextNodes = true,
    logCallback?: (message: LogMessage) => void,
  ) {
    this.htmlPath = htmlPath;
    this.observableDOMFactory = observableDOMFactory;
    this.ignoreTextNodes = ignoreTextNodes;
    this.logCallback = logCallback;
  }

  public isLoaded() {
    return this.loadedState !== null;
  }

  public load(htmlContents: string, params?: object) {
    if (params !== undefined) {
      this.params = params;
    }

    let oldInstanceRoot: StaticVirtualDOMElement | null = null;
    if (
      this.loadedState.type === NetworkedDOMState.DocumentLoaded ||
      this.loadedState.type === NetworkedDOMState.DocumentLoading
    ) {
      const oldInstance = this.loadedState.networkedDOM;
      oldInstance.dispose();
      oldInstanceRoot = oldInstance.getSnapshot();
    }
    let didLoad = false;
    let hasSetLoading = false;
    const networkedDOM = new NetworkedDOM(
      this.observableDOMFactory,
      this.htmlPath,
      htmlContents,
      oldInstanceRoot,
      (domDiff: VirtualDOMDiffStruct | null, networkedDOM: NetworkedDOM) => {
        didLoad = true;
        if (!hasSetLoading) {
          hasSetLoading = true;
          this.loadedState = {
            type: NetworkedDOMState.DocumentLoaded,
            htmlContents,
            networkedDOM,
          };
        } else if (
          this.loadedState &&
          this.loadedState.type === NetworkedDOMState.DocumentLoading &&
          this.loadedState.networkedDOM === networkedDOM
        ) {
          this.loadedState = {
            type: NetworkedDOMState.DocumentLoaded,
            htmlContents,
            networkedDOM,
          };
        }
        networkedDOM.addExistingNetworkedDOMConnections(new Set(this.websockets.values()), domDiff);
      },
      this.params,
      this.ignoreTextNodes,
      this.logCallback,
    );
    hasSetLoading = true;
    if (!didLoad) {
      this.loadedState = {
        type: NetworkedDOMState.DocumentLoading,
        htmlContents,
        networkedDOM,
      };
    }
  }

  public reload() {
    if (this.loadedState && this.loadedState.type === NetworkedDOMState.DocumentLoaded) {
      this.load(this.loadedState.htmlContents, this.params);
    } else {
      console.warn("EditableNetworkedDOM.reload called whilst not loaded");
    }
  }

  public dispose() {
    for (const [ws, networkedDOMConnection] of this.websockets) {
      networkedDOMConnection.dispose();
      ws.close();
    }
    this.websockets.clear();
    if (
      this.loadedState.type === NetworkedDOMState.DocumentLoaded ||
      this.loadedState.type === NetworkedDOMState.DocumentLoading
    ) {
      this.loadedState.networkedDOM.dispose();
    }
    this.loadedState = {
      type: NetworkedDOMState.BeforeDocumentLoaded,
    };
  }

  public addWebSocket(webSocket: WebSocket) {
    const networkedDOMConnection = createNetworkedDOMConnectionForWebsocket(webSocket);
    if (networkedDOMConnection === null) {
      // Error is handled in createNetworkedDOMConnectionForWebsocket
      return;
    }

    this.websockets.set(webSocket, networkedDOMConnection);
    if (this.loadedState.type === NetworkedDOMState.DocumentLoaded) {
      this.loadedState.networkedDOM.addNetworkedDOMConnection(networkedDOMConnection);
    }
  }

  public removeWebSocket(webSocket: WebSocket) {
    const networkedDOMConnection = this.websockets.get(webSocket);
    if (networkedDOMConnection === undefined) {
      throw new Error("Unknown websocket");
    }
    networkedDOMConnection.dispose();
    this.websockets.delete(webSocket);
    if (this.loadedState.type === NetworkedDOMState.DocumentLoaded) {
      this.loadedState.networkedDOM.removeNetworkedDOMConnection(networkedDOMConnection);
    }
  }
}
