import {
  BufferReader,
  decodeServerMessages,
  networkedDOMProtocolSubProtocol_v0_1,
  networkedDOMProtocolSubProtocol_v0_2_1,
  NetworkedDOMV01ServerMessage,
  NetworkedDOMV02ServerMessage,
} from "@mml-io/networked-dom-protocol";
import { NetworkedDOMWebsocket, NetworkedDOMWebsocketStatus } from "@mml-io/networked-dom-web";
import { FakeWebsocket } from "@mml-io/networked-dom-web-runner";

import { formatHTML, waitFor } from "./test-util";

export class TestCaseNetworkedDOMClient {
  public allClientMessages: Array<Uint8Array | string> = [];
  public clientElement = document.createElement("div");
  public networkedDOMWebsocket: NetworkedDOMWebsocket;
  public fakeWebSocket: FakeWebsocket;
  private statusListeners: Set<(status: NetworkedDOMWebsocketStatus) => void> = new Set();

  constructor(private useV01 = false) {
    this.fakeWebSocket = new FakeWebsocket(
      useV01 ? networkedDOMProtocolSubProtocol_v0_1 : networkedDOMProtocolSubProtocol_v0_2_1,
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

  private getClientMessageCount(ignorePing = true): number {
    if (this.useV01) {
      const messages = this.getV01DecodedMessages(0, ignorePing);
      return messages.length;
    } else {
      const messages = this.getV02DecodedMessages(0, ignorePing);
      return messages.length;
    }
  }

  async waitForAllClientMessages(count: number, timeout = 1000, ignorePing = true) {
    // Get current stack trace (before async) to aid debugging
    const stack = new Error().stack;
    await waitFor(() => {
      const haveCount = this.getClientMessageCount(ignorePing);
      if (haveCount < count) {
        return `Have ${haveCount} messages, waiting for ${count}`;
      }
      return true;
    }, timeout);
    const messageLength = this.getClientMessageCount(ignorePing);
    if (messageLength !== count) {
      throw new (Error as any)(`Expected ${count} messages, got ${messageLength}. Stack: ${stack}`);
    }
  }

  getV01DecodedMessages(startFrom = 0, ignorePing = true): Array<NetworkedDOMV01ServerMessage> {
    const allMessages = this.allClientMessages as string[];
    let messages: Array<NetworkedDOMV01ServerMessage> = [];
    for (const msg of allMessages) {
      const parsed = JSON.parse(msg);
      messages.push(parsed);
    }
    messages = messages.slice(startFrom);
    if (ignorePing) {
      return messages.filter((msg) => msg.type !== "ping");
    }
    return messages;
  }

  getV02DecodedMessages(startFrom = 0, ignorePing = true): Array<NetworkedDOMV02ServerMessage> {
    const allMessages = this.allClientMessages as Uint8Array[];
    const buffer = new Uint8Array(allMessages.reduce((acc, msg) => acc + msg.byteLength, 0));
    let offset = 0;
    for (const msg of allMessages) {
      buffer.set(msg, offset);
      offset += msg.length;
    }
    const reader = new BufferReader(buffer);
    const decoded = decodeServerMessages(reader).slice(startFrom);
    if (ignorePing) {
      return decoded.filter((msg) => msg.type !== "ping");
    }
    return decoded;
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
