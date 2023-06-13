import { EditableNetworkedDOM, NetworkedDOM } from "@mml-io/networked-dom-document";
import { NetworkedDOMWebsocket } from "@mml-io/networked-dom-web";

import { FakeWebsocket } from "./FakeWebsocket";

export class NetworkedDOMWebRunnerClient {
  public readonly element: HTMLDivElement;
  protected remoteDocumentHolder: HTMLElement;

  protected connectedState: {
    document: NetworkedDOM | EditableNetworkedDOM;
    domWebsocket: NetworkedDOMWebsocket;
    fakeWebsocket: FakeWebsocket;
  } | null = null;
  private enableEventHandling: boolean;

  constructor(enableEventHandling = true) {
    this.enableEventHandling = enableEventHandling;
    this.element = document.createElement("div");
    this.element.style.position = "relative";
    this.element.style.width = "100%";
    this.element.style.height = "100%";
    this.element.style.border = "1px solid black";

    this.remoteDocumentHolder = document.createElement("div");
    this.element.append(this.remoteDocumentHolder);
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
    this.remoteDocumentHolder.remove();
    this.element.remove();
  }

  public connect(document: NetworkedDOM | EditableNetworkedDOM) {
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
      this.remoteDocumentHolder.addEventListener("click", (event: Event) => {
        eventHandler(event.target as HTMLElement, event as CustomEvent);
        event.stopPropagation();
        event.preventDefault();
        return false;
      });
    }

    const domWebsocket = new NetworkedDOMWebsocket(
      "ws://localhost",
      () => fakeWebsocket.clientSideWebsocket as unknown as WebSocket,
      this.remoteDocumentHolder,
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
