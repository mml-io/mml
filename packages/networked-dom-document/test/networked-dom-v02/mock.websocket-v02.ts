import {
  BufferReader,
  BufferWriter,
  decodeServerMessages,
  encodeClientMessage,
  networkedDOMProtocolSubProtocol_v0_2,
  NetworkedDOMV02ClientMessage,
  NetworkedDOMV02ServerMessage,
} from "@mml-io/networked-dom-protocol";

export class MockWebsocketV02 {
  public readonly protocol = networkedDOMProtocolSubProtocol_v0_2;
  private allMessages: Array<NetworkedDOMV02ServerMessage> = [];
  private messageTriggers = new Set<() => void>();
  private serverMessageListeners = new Set<(message: MessageEvent) => void>();
  private serverCloseListeners = new Set<() => void>();

  send(data: Uint8Array) {
    const reader = new BufferReader(data);
    const messages = decodeServerMessages(reader);
    this.allMessages.push(...messages);
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
  ): Promise<Array<NetworkedDOMV02ServerMessage>> {
    let resolveProm: (value: Array<NetworkedDOMV02ServerMessage>) => void;
    const promise = new Promise<Array<NetworkedDOMV02ServerMessage>>((resolve) => {
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

  sendToServer(toSend: NetworkedDOMV02ClientMessage) {
    const writer = new BufferWriter(32);
    encodeClientMessage(toSend, writer);
    this.serverMessageListeners.forEach((listener) => {
      listener(
        new MessageEvent("message", {
          data: writer.getBuffer(),
        }),
      );
    });
  }
}
