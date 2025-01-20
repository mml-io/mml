import {
  networkedDOMProtocolSubProtocol_v0_1,
  networkedDOMProtocolSubProtocol_v0_2,
} from "@mml-io/networked-dom-protocol";
import { NetworkedDOMWebsocket, NetworkedDOMWebsocketStatus } from "@mml-io/networked-dom-web";
import { FakeWebsocket } from "@mml-io/networked-dom-web-runner";

import { formatHTML, waitFor } from "./test-util";

export class TestCaseNetworkedDOMClient {
  public allClientMessages: Array<MessageEvent> = [];
  public clientElement = document.createElement("div");
  public networkedDOMWebsocket: NetworkedDOMWebsocket;
  public fakeWebSocket: FakeWebsocket;
  private statusListeners: Set<(status: NetworkedDOMWebsocketStatus) => void> = new Set();

  constructor(useV01 = false) {
    this.fakeWebSocket = new FakeWebsocket(
      useV01 ? networkedDOMProtocolSubProtocol_v0_1 : networkedDOMProtocolSubProtocol_v0_2,
    );
    this.fakeWebSocket.clientSideWebsocket.addEventListener("message", (evt: MessageEvent) => {
      this.allClientMessages.push(evt.data);
    });

    document.body.append(this.clientElement);

    this.networkedDOMWebsocket = new NetworkedDOMWebsocket(
      "ws://example.com",
      () => {
        return this.fakeWebSocket.clientSideWebsocket as unknown as WebSocket;
      },
      this.clientElement,
      () => {},
      (status) => {
        for (const listener of this.statusListeners) {
          listener(status);
        }
      },
    );
  }

  getFormattedHTML() {
    return formatHTML(this.clientElement.innerHTML);
  }

  async waitForAllClientMessages(count: number) {
    await waitFor(() => this.allClientMessages.length >= count, 1000);
    if (this.allClientMessages.length !== count) {
      throw new Error(`Expected ${count} messages, got ${this.allClientMessages.length}`);
    }
  }

  async onConnectionOpened() {
    return new Promise<void>((resolve) => {
      const listener = (status: NetworkedDOMWebsocketStatus) => {
        if (
          status === NetworkedDOMWebsocketStatus.Connected ||
          status === NetworkedDOMWebsocketStatus.ConnectionOpen
        ) {
          this.statusListeners.delete(listener);
          resolve();
        }
      };
      this.statusListeners.add(listener);
    });
  }
}
