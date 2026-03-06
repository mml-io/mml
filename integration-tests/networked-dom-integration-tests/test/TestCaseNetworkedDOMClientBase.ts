import {
  BufferReader,
  decodeServerMessages,
  NetworkedDOMV01ServerMessage,
  NetworkedDOMV02ServerMessage,
} from "@mml-io/networked-dom-protocol";
import {
  IElementLike,
  NetworkedDOMWebsocket,
  NetworkedDOMWebsocketStatus,
} from "@mml-io/networked-dom-web";
import { FakeWebsocket } from "@mml-io/networked-dom-web-runner";

import { waitFor } from "./test-util";

export abstract class TestCaseNetworkedDOMClientBase {
  public allClientMessages: Array<Uint8Array | string> = [];
  public abstract networkedDOMWebsocket: NetworkedDOMWebsocket;
  public abstract fakeWebSocket: FakeWebsocket;
  protected statusListeners: Set<(status: NetworkedDOMWebsocketStatus) => void> = new Set();

  constructor(protected useV01 = false) {}

  abstract getFormattedHTML(): string;
  abstract querySelector(selector: string): IElementLike | null;
  abstract dispose(): void;

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
      throw new Error(`Expected ${count} messages, got ${messageLength}. Stack: ${stack}`);
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

  async onConnectionOpened(timeout = 5000) {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.statusListeners.delete(listener);
        reject(new Error(`onConnectionOpened timed out after ${timeout}ms`));
      }, timeout);
      const listener = (status: NetworkedDOMWebsocketStatus) => {
        if (
          status === NetworkedDOMWebsocketStatus.Connected ||
          status === NetworkedDOMWebsocketStatus.ConnectionOpen
        ) {
          clearTimeout(timer);
          this.statusListeners.delete(listener);
          resolve();
        }
      };
      this.statusListeners.add(listener);
    });
  }
}
