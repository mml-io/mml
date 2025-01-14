import {
  networkedDOMProtocolSubProtocol_v0_1,
  NetworkedDOMV01ClientMessage,
  NetworkedDOMV01ServerMessage,
} from "@mml-io/networked-dom-protocol";

export class MockWebsocketV01 {
  public readonly protocol = networkedDOMProtocolSubProtocol_v0_1;
  private allMessages: Array<NetworkedDOMV01ServerMessage> = [];
  private messageTriggers = new Set<() => void>();
  private serverMessageListeners = new Set<(message: MessageEvent) => void>();
  private serverCloseListeners = new Set<() => void>();

  send(data: string) {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      throw new Error("Expected an array of messages");
    }
    this.allMessages.push(...parsed);
    this.messageTriggers.forEach((trigger) => {
      trigger();
    });
  }

  public close() {
    // TODO - implement listening for when server closes
  }

  async waitForTotalMessageCount(
    totalMessageCount: number,
    startFrom = 0,
  ): Promise<Array<NetworkedDOMV01ServerMessage>> {
    let resolveProm: (value: Array<NetworkedDOMV01ServerMessage>) => void;
    const promise = new Promise<Array<NetworkedDOMV01ServerMessage>>((resolve) => {
      resolveProm = resolve;
    });

    if (this.allMessages.length >= totalMessageCount) {
      return this.allMessages.slice(startFrom, totalMessageCount);
    }

    const trigger = () => {
      if (this.allMessages.length >= totalMessageCount) {
        this.messageTriggers.delete(trigger);
        resolveProm(this.allMessages.slice(startFrom, totalMessageCount));
      }
    };
    this.messageTriggers.add(trigger);
    return promise;
  }

  addEventListener(eventType: string, listener: () => void) {
    if (eventType === "message") {
      this.serverMessageListeners.add(listener);
    } else if (eventType === "close") {
      this.serverCloseListeners.add(listener);
    }
  }

  removeEventListener(eventType: string, listener: () => void) {
    if (eventType === "message") {
      this.serverMessageListeners.delete(listener);
    } else {
      this.serverCloseListeners.delete(listener);
    }
  }

  sendToServer(toSend: NetworkedDOMV01ClientMessage) {
    const asString = JSON.stringify(toSend);
    this.serverMessageListeners.forEach((listener) => {
      listener(
        new MessageEvent("message", {
          data: asString,
        }),
      );
    });
  }
}
