import { VirtualDocument, VirtualHTMLElement } from "@mml-io/mml-web";
import {
  networkedDOMProtocolSubProtocol_v0_1,
  networkedDOMProtocolSubProtocol_v0_2_1,
} from "@mml-io/networked-dom-protocol";
import { IElementLike, NetworkedDOMWebsocket } from "@mml-io/networked-dom-web";
import { FakeWebsocket } from "@mml-io/networked-dom-web-runner";

import { formatHTML } from "./test-util";
import { TestCaseNetworkedDOMClientBase } from "./TestCaseNetworkedDOMClientBase";

export class TestCaseNetworkedDOMClientVirtual extends TestCaseNetworkedDOMClientBase {
  public clientElement: VirtualHTMLElement;
  public networkedDOMWebsocket: NetworkedDOMWebsocket;
  public fakeWebSocket: FakeWebsocket;
  private virtualDoc: VirtualDocument;

  constructor(useV01 = false) {
    super(useV01);
    this.virtualDoc = new VirtualDocument();
    this.clientElement = this.virtualDoc.createElement("div");
    this.clientElement.setRootConnected(true);

    this.fakeWebSocket = new FakeWebsocket(
      useV01 ? networkedDOMProtocolSubProtocol_v0_1 : networkedDOMProtocolSubProtocol_v0_2_1,
    );
    this.fakeWebSocket.clientSideWebsocket.addEventListener("message", (evt: MessageEvent) => {
      this.allClientMessages.push(evt.data);
    });

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
      {},
      this.virtualDoc,
    );
  }

  getFormattedHTML() {
    return formatHTML(this.clientElement.innerHTML);
  }

  querySelector(selector: string): IElementLike | null {
    return this.clientElement.querySelector(selector);
  }

  dispose() {
    this.networkedDOMWebsocket.stop();
    this.clientElement.setRootConnected(false);
    this.allClientMessages.length = 0;
    this.statusListeners.clear();
  }
}
