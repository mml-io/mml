import {
  NetworkedDOMV01ClientMessage,
  NetworkedDOMV01ServerMessage,
} from "@mml-io/networked-dom-protocol";

import { NetworkedDOM } from "./NetworkedDOM";

export class NetworkedDOMV01Connection {
  private websocketListener: (messageEvent: MessageEvent) => void;

  public internalConnectionId: number | null = null;
  public internalIdToExternalId = new Map<number, number>();
  public networkedDOM: NetworkedDOM | null = null;

  public constructor(public readonly webSocket: WebSocket) {
    this.websocketListener = (messageEvent: MessageEvent) => {
      const string = String(messageEvent.data);
      let parsed;
      try {
        parsed = JSON.parse(string) as NetworkedDOMV01ClientMessage;
      } catch (e) {
        console.error(`Error parsing message from websocket: ${string}`, e);
        console.trace();
        return;
      }

      switch (parsed.type) {
        case "pong":
          // Ignore pongs for now
          return;
        case "event": {
          if (!this.networkedDOM) {
            console.error("NetworkedDOM not set on connection that received event", this);
            return;
          }
          if (this.internalConnectionId === null) {
            console.error("Internal connection ID not set on connection that received event", this);
            return;
          }
          this.networkedDOM.dispatchRemoteEvent(this, this.internalConnectionId, 1, {
            nodeId: parsed.nodeId,
            name: parsed.name,
            bubbles: parsed.bubbles ?? true,
            params: parsed.params,
          });
          return;
        }
        default:
          console.error("Unknown message type from client", parsed);
      }
    };
    webSocket.addEventListener("message", this.websocketListener);
  }

  public setNetworkedDOM(networkedDOM: NetworkedDOM | null) {
    this.networkedDOM = networkedDOM;
  }

  public initAsNewV01Connection() {
    if (!this.networkedDOM) {
      throw new Error("NetworkedDOM not set on connection");
    }
    const internalConnectionIds = this.networkedDOM.connectUsers(this, new Set([1]));
    this.internalConnectionId = internalConnectionIds.entries().next().value[0] as number;
    this.internalIdToExternalId.set(this.internalConnectionId, 1);
    this.networkedDOM.announceConnectedUsers(
      new Map<number, string | null>([[this.internalConnectionId, null]]),
    );
  }

  public stringifyAndSendSingleMessage(message: NetworkedDOMV01ServerMessage) {
    this.webSocket.send("[" + JSON.stringify(message) + "]");
  }

  public sendStringifiedJSONArray(jsonArray: string) {
    this.webSocket.send(jsonArray);
  }

  public dispose() {
    this.webSocket.removeEventListener("message", this.websocketListener);
  }
}
