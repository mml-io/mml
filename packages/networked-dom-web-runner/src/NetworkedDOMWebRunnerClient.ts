import { EditableNetworkedDOM, NetworkedDOM } from "@mml-io/networked-dom-document";
import { NetworkedDOMWebsocket } from "@mml-io/networked-dom-web";

import { FakeWebsocket } from "./FakeWebsocket";

/**
 * The NetworkedDOMWebRunnerClient class can be used to view and interact with a NetworkedDOM document instance that is
 * available directly in the browser (rather than exposed over the network). This is useful for usage modes where the
 * document does not need to be available to other clients, such as a single-user or an edit/preview mode.
 *
 * The class takes arguments for where the view of the document should be synchronized to in the DOM, and which window
 * instance to use to create any other elements (to allow for using iframes to isolate the document from the rest of
 * the page).
 */
export class NetworkedDOMWebRunnerClient {
  public readonly element: HTMLElement;

  public connectedState: {
    document: NetworkedDOM | EditableNetworkedDOM;
    domWebsocket: NetworkedDOMWebsocket;
    fakeWebsocket: FakeWebsocket;
  } | null = null;
  private enableEventHandling: boolean;

  constructor(enableEventHandling = true, element?: HTMLElement) {
    this.enableEventHandling = enableEventHandling;
    this.element = element || document.createElement("div");
  }

  public disconnect() {
    if (!this.connectedState) {
      return;
    }
    this.connectedState.document.removeWebSocket(
      this.connectedState.fakeWebsocket.serverSideWebsocket as unknown as WebSocket,
    );
    this.connectedState = null;
  }

  public dispose() {
    this.disconnect();
    this.element.remove();
  }

  public connect(
    document: NetworkedDOM | EditableNetworkedDOM,
    timeCallback?: (time: number) => void,
  ) {
    if (this.connectedState) {
      this.disconnect();
    }
    const fakeWebsocket = new FakeWebsocket("networked-dom-v0.1");
    let overriddenHandler: ((element: HTMLElement, event: CustomEvent) => void) | null = null;
    const eventHandler = (element: HTMLElement, event: CustomEvent) => {
      if (!overriddenHandler) {
        throw new Error("overriddenHandler not set");
      }
      overriddenHandler(element, event);
    };

    if (this.enableEventHandling) {
      this.element.addEventListener("click", (event: Event) => {
        eventHandler(event.target as HTMLElement, event as CustomEvent);
        event.stopPropagation();
        event.preventDefault();
        return false;
      });
    }

    const domWebsocket = new NetworkedDOMWebsocket(
      "ws://localhost",
      () => fakeWebsocket.clientSideWebsocket as unknown as WebSocket,
      this.element,
      timeCallback,
    );
    overriddenHandler = (element: HTMLElement, event: CustomEvent) => {
      domWebsocket.handleEvent(element, event);
    };
    document.addWebSocket(fakeWebsocket.serverSideWebsocket as unknown as WebSocket);
    this.connectedState = {
      document,
      fakeWebsocket,
      domWebsocket,
    };
  }
}
