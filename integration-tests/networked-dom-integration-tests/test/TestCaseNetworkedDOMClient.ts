import { NetworkedDOMWebsocket } from "@mml-io/networked-dom-web";
import { FakeWebsocket } from "@mml-io/networked-dom-web-runner";

import { formatHTML, waitFor } from "./test-util";

export class TestCaseNetworkedDOMClient {
  public fakeWebSocket = new FakeWebsocket("");
  public allClientMessages: Array<MessageEvent> = [];
  public clientElement = document.createElement("div");
  private clientWebsocket: NetworkedDOMWebsocket;

  constructor() {
    this.fakeWebSocket.clientSideWebsocket.addEventListener("message", (evt: MessageEvent) => {
      this.allClientMessages.push(evt.data);
    });

    document.body.append(this.clientElement);

    this.clientWebsocket = new NetworkedDOMWebsocket(
      "ws://example.com",
      () => {
        return this.fakeWebSocket.clientSideWebsocket as unknown as WebSocket;
      },
      this.clientElement,
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
}
