import {
  networkedDOMProtocolSubProtocol_v0_1,
  networkedDOMProtocolSubProtocol_v0_2,
} from "@mml-io/networked-dom-protocol";

import { NetworkedDOMWebsocketV01Adapter } from "./NetworkedDOMWebsocketV01Adapter";
import { NetworkedDOMWebsocketV02Adapter } from "./NetworkedDOMWebsocketV02Adapter";

const startingBackoffTimeMilliseconds = 100;
const maximumBackoffTimeMilliseconds = 10000;
const maximumWebsocketConnectionTimeout = 5000;

export type NetworkedDOMWebsocketFactory = (url: string) => WebSocket;

export enum NetworkedDOMWebsocketStatus {
  Connecting,
  ConnectionOpen, // The websocket is open and connected, but no messages have been received yet
  Connected, // The websocket is open and connected, and messages are being received
  Reconnecting,
  Disconnected,
}

export function NetworkedDOMWebsocketStatusToString(status: NetworkedDOMWebsocketStatus): string {
  switch (status) {
    case NetworkedDOMWebsocketStatus.Connecting:
      return "Connecting...";
    case NetworkedDOMWebsocketStatus.ConnectionOpen:
      return "Connection Open";
    case NetworkedDOMWebsocketStatus.Connected:
      return "Connected";
    case NetworkedDOMWebsocketStatus.Reconnecting:
      return "Reconnecting...";
    case NetworkedDOMWebsocketStatus.Disconnected:
      return "Disconnected";
    default:
      return "Unknown";
  }
}

export type NetworkedDOMWebsocketOptions = {
  tagPrefix?: string; // e.g. "m-" to restrict to only custom elements with a tag name starting with "m-"
  replacementTagPrefix?: string; // e.g. "x-" to replace non-prefixed tags with a new prefix (e.g. "div" -> "x-div")
};

export type NetworkedDOMWebsocketAdapter = {
  receiveMessage: (message: MessageEvent) => void;
  handleEvent: (element: HTMLElement, event: CustomEvent<{ element: HTMLElement }>) => void;
  clearContents: () => boolean;
};

/**
 * NetworkedDOMWebsocket is a client for a NetworkedDOMServer. It connects to a server on the provided url and receives
 * updates to the DOM. It also sends events to the server for interactions with the DOM.
 *
 * The NetworkedDOMWebsocket is attached to a parentElement and synchronizes the received DOM under that element.
 */
export class NetworkedDOMWebsocket {
  private websocket: WebSocket | null = null;
  private websocketAdapter: NetworkedDOMWebsocketAdapter | null = null;

  private stopped = false;
  private backoffTime = startingBackoffTimeMilliseconds;
  private status: NetworkedDOMWebsocketStatus | null = null;

  public static createWebSocket(url: string): WebSocket {
    return new WebSocket(url, [
      networkedDOMProtocolSubProtocol_v0_2,
      networkedDOMProtocolSubProtocol_v0_1,
    ]);
  }

  constructor(
    private url: string,
    private websocketFactory: NetworkedDOMWebsocketFactory,
    private parentElement: HTMLElement,
    private timeCallback?: (time: number) => void,
    private statusUpdateCallback?: (status: NetworkedDOMWebsocketStatus) => void,
    private options: NetworkedDOMWebsocketOptions = {},
  ) {
    this.setStatus(NetworkedDOMWebsocketStatus.Connecting);
    this.startWebSocketConnectionAttempt();
  }

  private setStatus(status: NetworkedDOMWebsocketStatus) {
    if (this.status !== status) {
      this.status = status;
      if (this.statusUpdateCallback) {
        this.statusUpdateCallback(status);
      }
    }
  }

  private createWebsocketWithTimeout(timeout: number): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const websocket = this.websocketFactory(this.url);
      const timeoutId = setTimeout(() => {
        reject(new Error("websocket connection timed out"));
        websocket.close();
      }, timeout);
      websocket.binaryType = "arraybuffer";
      websocket.addEventListener("open", () => {
        clearTimeout(timeoutId);

        this.websocket = websocket;
        const isV02 = websocket.protocol === networkedDOMProtocolSubProtocol_v0_2;
        let websocketAdapter: NetworkedDOMWebsocketAdapter;
        if (isV02) {
          websocketAdapter = new NetworkedDOMWebsocketV02Adapter(
            websocket,
            this.parentElement,
            () => {
              this.backoffTime = startingBackoffTimeMilliseconds;
              this.setStatus(NetworkedDOMWebsocketStatus.Connected);
            },
            this.timeCallback,
            this.options,
          );
        } else {
          websocketAdapter = new NetworkedDOMWebsocketV01Adapter(
            websocket,
            this.parentElement,
            () => {
              this.backoffTime = startingBackoffTimeMilliseconds;
              this.setStatus(NetworkedDOMWebsocketStatus.Connected);
            },
            this.timeCallback,
            this.options,
          );
        }
        this.websocketAdapter = websocketAdapter;

        websocket.addEventListener("message", (event) => {
          if (websocket !== this.websocket) {
            console.log("Ignoring websocket message event because it is no longer current");
            websocket.close();
            return;
          }
          websocketAdapter.receiveMessage(event);
        });

        const onWebsocketClose = async () => {
          let hadContents = false;
          if (this.websocketAdapter) {
            hadContents = this.websocketAdapter.clearContents();
          }
          if (this.stopped) {
            // This closing is expected. The client closed the websocket.
            this.setStatus(NetworkedDOMWebsocketStatus.Disconnected);
            return;
          }
          if (!hadContents) {
            // The websocket did not deliver any contents. It may have been successfully opened, but immediately closed. This client should back off to prevent this happening in a rapid loop.
            await this.waitBackoffTime();
          }
          // The websocket closed unexpectedly. Try to reconnect.
          this.setStatus(NetworkedDOMWebsocketStatus.Reconnecting);
          this.startWebSocketConnectionAttempt();
        };

        websocket.addEventListener("close", () => {
          if (websocket !== this.websocket) {
            console.warn("Ignoring websocket close event because it is no longer current");
            return;
          }
          onWebsocketClose();
        });
        websocket.addEventListener("error", (e) => {
          if (websocket !== this.websocket) {
            console.log("Ignoring websocket error event because it is no longer current");
            return;
          }
          console.error("NetworkedDOMWebsocket error", e);
          onWebsocketClose();
        });

        this.setStatus(NetworkedDOMWebsocketStatus.ConnectionOpen);
        resolve(websocket);
      });
      websocket.addEventListener("error", (e) => {
        clearTimeout(timeoutId);
        reject(e);
      });
    });
  }

  private async waitBackoffTime(): Promise<void> {
    console.warn(`Websocket connection to '${this.url}' failed: retrying in ${this.backoffTime}ms`);
    await new Promise((resolve) => setTimeout(resolve, this.backoffTime));
    this.backoffTime = Math.min(
      // Introduce a small amount of randomness to prevent clients from retrying in lockstep
      this.backoffTime * (1.5 + Math.random() * 0.5),
      maximumBackoffTimeMilliseconds,
    );
  }

  private async startWebSocketConnectionAttempt() {
    if (this.stopped) {
      return;
    }
    while (true) {
      if (this.stopped) {
        return;
      }
      try {
        await this.createWebsocketWithTimeout(maximumWebsocketConnectionTimeout);
        break;
      } catch (e) {
        console.error("Websocket connection failed", e);
        // Connection failed, retry with backoff
        this.setStatus(NetworkedDOMWebsocketStatus.Reconnecting);
        await this.waitBackoffTime();
      }
    }
  }

  public stop() {
    this.stopped = true;
    if (this.websocket !== null) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  public handleEvent(element: HTMLElement, event: CustomEvent<{ element: HTMLElement }>) {
    if (this.websocketAdapter) {
      this.websocketAdapter.handleEvent(element, event);
    }
  }
}

export function isHTMLElement(node: unknown, rootNode: HTMLElement): node is HTMLElement {
  if (node instanceof HTMLElement) {
    return true;
  }
  if (!rootNode.ownerDocument.defaultView) {
    return false;
  }
  return node instanceof rootNode.ownerDocument.defaultView.HTMLElement;
}

export function isText(node: unknown, rootNode: HTMLElement): node is Text {
  if (node instanceof Text) {
    return true;
  }
  if (!rootNode.ownerDocument.defaultView) {
    return false;
  }
  return node instanceof rootNode.ownerDocument.defaultView.Text;
}
