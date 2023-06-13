import { LogMessage, StaticVirtualDomElement } from "@mml-io/observable-dom-common";

import { VirtualDOMDiffStruct } from "./common";
import { NetworkedDOM, ObservableDomFactory } from "./NetworkedDOM";

type LoadedState = {
  htmlContents: string;
  networkedDOM: NetworkedDOM;
  loaded: boolean;
};

// EditableNetworkedDOM wraps NetworkedDOM instances and presents them as a single document that can iterate through
// revisions by being loaded multiple times with different contents. The connected clients receive deltas between the
// revisions rather than a complete refresh.
export class EditableNetworkedDOM {
  private htmlPath: string;
  private params: object = {};

  private websockets = new Set<WebSocket>();
  private loadedState: LoadedState | null = null;

  private observableDOMFactory: ObservableDomFactory;
  private ignoreTextNodes: boolean;

  private logCallback?: (message: LogMessage) => void;

  constructor(
    htmlPath: string,
    observableDOMFactory: ObservableDomFactory,
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

    let oldInstanceRoot: StaticVirtualDomElement | null = null;
    let existingWebsocketMap: Map<WebSocket, number> | null = null;
    if (this.loadedState) {
      const oldInstance = this.loadedState.networkedDOM;
      existingWebsocketMap = oldInstance.getWebsocketConnectionIdMap();
      oldInstance.dispose();
      oldInstanceRoot = oldInstance.getSnapshot();
    }
    this.loadedState = null;

    let didLoad = false;
    const networkedDOM = new NetworkedDOM(
      this.observableDOMFactory,
      this.htmlPath,
      htmlContents,
      oldInstanceRoot,
      (domDiff: VirtualDOMDiffStruct | null) => {
        didLoad = true;
        if (this.loadedState) {
          this.loadedState.loaded = true;
        }
        networkedDOM.addExistingWebsockets(
          Array.from(this.websockets),
          existingWebsocketMap,
          domDiff,
        );
      },
      this.params,
      this.ignoreTextNodes,
      this.logCallback,
    );
    this.loadedState = {
      htmlContents,
      networkedDOM,
      loaded: didLoad,
    };
  }

  public reload() {
    if (this.loadedState) {
      this.load(this.loadedState.htmlContents, this.params);
    } else {
      console.warn("EditableNetworkedDOM.reload called whilst not loaded");
    }
  }

  public dispose() {
    for (const ws of this.websockets) {
      ws.close();
    }
    this.websockets.clear();
    if (this.loadedState) {
      this.loadedState.networkedDOM.dispose();
    }
    this.loadedState = null;
  }

  public addWebSocket(webSocket: WebSocket) {
    this.websockets.add(webSocket);
    if (this.loadedState && this.loadedState.loaded) {
      this.loadedState.networkedDOM.addWebSocket(webSocket);
    }
  }

  public removeWebSocket(webSocket: WebSocket) {
    this.websockets.delete(webSocket);
    if (this.loadedState && this.loadedState.loaded) {
      this.loadedState.networkedDOM.removeWebSocket(webSocket);
    }
  }

  public addIPCWebSocket(webSocket: WebSocket) {
    if (this.loadedState && this.loadedState.loaded) {
      this.loadedState.networkedDOM.addIPCWebSocket(webSocket);
    } else {
      console.error("Dom instance not loaded/ready to accept IPC websocket");
      webSocket.close();
      return;
    }
  }
}
