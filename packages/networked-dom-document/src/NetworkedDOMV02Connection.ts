import {
  BufferReader,
  BufferWriter,
  decodeClientMessages,
  encodeBatchEnd,
  encodeBatchStart,
  encodeServerMessage,
  NetworkedDOMV02ClientMessage,
  NetworkedDOMV02ServerMessage,
} from "@mml-io/networked-dom-protocol";

import { NetworkedDOM } from "./NetworkedDOM";

export class NetworkedDOMV02Connection {
  private websocketListener: (messageEvent: MessageEvent) => void;

  public externalIdToInternalId = new Map<number, number>();
  public internalIdToExternalId = new Map<number, number>();
  private batchMode: boolean = false;
  private batchMessages: Array<NetworkedDOMV02ServerMessage | Uint8Array> = [];
  public externalConnectionIds = new Set<number>();

  public networkedDOM: NetworkedDOM | null = null;
  private messagesAwaitingNetworkedDOM: Array<NetworkedDOMV02ClientMessage> = [];

  public constructor(public readonly webSocket: WebSocket) {
    this.websocketListener = (messageEvent: MessageEvent) => {
      const buffer = new Uint8Array(messageEvent.data as ArrayBuffer);
      const messages = decodeClientMessages(new BufferReader(buffer));
      for (const parsed of messages) {
        if (this.networkedDOM) {
          this.handleClientMessage(parsed);
        } else {
          this.messagesAwaitingNetworkedDOM.push(parsed);
        }
      }
    };
    webSocket.addEventListener("message", this.websocketListener);
  }

  public setNetworkedDOM(networkedDOM: NetworkedDOM | null) {
    this.networkedDOM = networkedDOM;
  }

  public setBatchStart() {
    this.batchMode = true;
  }

  public setBatchEnd() {
    this.batchMode = false;
    if (this.batchMessages.length === 0) {
      return;
    }
    const includeBatchStartAndEnd = this.batchMessages.length > 1;
    let toSendBytes: Uint8Array;

    if (
      this.batchMessages.length === 1 &&
      this.batchMessages[0] instanceof Uint8Array &&
      !includeBatchStartAndEnd
    ) {
      // There is only one message, it's already encoded, and we don't need to include batch start and end so we can send it directly
      toSendBytes = this.batchMessages[0];
    } else {
      const bufferWriter = new BufferWriter(256);
      if (includeBatchStartAndEnd) {
        encodeBatchStart(bufferWriter);
      }
      for (const message of this.batchMessages) {
        if (message instanceof Uint8Array) {
          bufferWriter.writeBytes(message);
        } else {
          encodeServerMessage(message, bufferWriter);
        }
      }
      if (includeBatchStartAndEnd) {
        encodeBatchEnd(bufferWriter);
      }
      toSendBytes = bufferWriter.getBuffer();
    }
    this.webSocket.send(toSendBytes);
    this.batchMessages = [];
  }

  public sendMessage(message: NetworkedDOMV02ServerMessage) {
    this.sendEncodedBytes(encodeServerMessage(message).getBuffer());
  }

  public sendMessages(messages: Array<NetworkedDOMV02ServerMessage>) {
    const bufferWriter = new BufferWriter(256);
    for (const message of messages) {
      encodeServerMessage(message, bufferWriter);
    }
    const bytes = bufferWriter.getBuffer();
    this.sendEncodedBytes(bytes);
  }

  public sendEncodedBytes(bytes: Uint8Array) {
    if (this.batchMode) {
      this.batchMessages.push(bytes);
      return;
    }
    // Non-batch mode - just send the bytes
    this.webSocket.send(bytes);
  }

  public dispose() {
    this.webSocket.removeEventListener("message", this.websocketListener);
  }

  private handleClientMessage(parsed: NetworkedDOMV02ClientMessage) {
    switch (parsed.type) {
      case "connectUsers": {
        const addedExternalUserIds = new Set<number>();
        for (const addingExternalId of parsed.connectionIds) {
          // Check if the connection ID is a positive integer
          if (!Number.isInteger(addingExternalId) || addingExternalId < 0) {
            this.sendMessage({
              type: "error",
              message: `Connection ID ${addingExternalId} is not a positive integer.`,
            });
            console.error("Connection ID is not a positive integer", addingExternalId);
            return;
          }

          if (this.externalConnectionIds.has(addingExternalId)) {
            this.sendMessage({
              type: "error",
              message: `Connection ID ${addingExternalId} already exists.`,
            });
            console.error("Connection ID already exists", addingExternalId);
            return;
          }
          this.externalConnectionIds.add(addingExternalId);
          if (addedExternalUserIds.has(addingExternalId)) {
            this.sendMessage({
              type: "error",
              message: `Connection ID ${addingExternalId} is duplicated.`,
            });
            console.error("Connection ID is duplicated in connectUsers", addingExternalId);
            return;
          }
          addedExternalUserIds.add(addingExternalId);
        }
        if (this.networkedDOM !== null) {
          const connectionIdToExternalId = this.networkedDOM.connectUsers(
            this,
            addedExternalUserIds,
          );
          const internalIds = new Set(Array.from(connectionIdToExternalId.keys()));
          for (const [addingInternalId, addingExternalId] of connectionIdToExternalId) {
            this.externalIdToInternalId.set(addingExternalId, addingInternalId);
            this.internalIdToExternalId.set(addingInternalId, addingExternalId);
          }
          this.networkedDOM.announceConnectedUsers(internalIds);
        }
        return;
      }
      case "disconnectUsers": {
        const removingExternalUserIds = new Set<number>();
        const removedExternalToInternalUserIds = new Map<number, number>();
        for (const removingExternalId of parsed.connectionIds) {
          if (!this.externalConnectionIds.has(removingExternalId)) {
            this.sendMessage({
              type: "error",
              message: `Connection ID ${removingExternalId} does not exist.`,
            });
            console.error("Connection ID not found", removingExternalId);
            return;
          }
          removingExternalUserIds.add(removingExternalId);
        }
        for (const removingExternalId of removingExternalUserIds) {
          const removingInternalId = this.externalIdToInternalId.get(removingExternalId);
          if (removingInternalId === undefined) {
            this.sendMessage({
              type: "error",
              message: `Connection ID ${removingExternalId} does not exist.`,
            });
            console.error(
              "Connection ID not found in externalIdToInternalId map",
              removingExternalId,
            );
            return;
          }
          if (removedExternalToInternalUserIds.has(removingExternalId)) {
            this.sendMessage({
              type: "error",
              message: `Connection ID ${removingExternalId} is duplicated.`,
            });
            console.error("Connection ID is duplicated in disconnectUsers", removingExternalId);
            return;
          }
          removedExternalToInternalUserIds.set(removingExternalId, removingInternalId);
        }

        if (this.networkedDOM === null) {
          for (const [removingExternalId, removingInternalId] of removedExternalToInternalUserIds) {
            this.externalConnectionIds.delete(removingExternalId);
            this.externalIdToInternalId.delete(removingExternalId);
            this.internalIdToExternalId.delete(removingInternalId);
          }
        } else {
          const removalDiffs = this.networkedDOM.disconnectUsers(
            this,
            removedExternalToInternalUserIds,
          );
          if (removalDiffs.length > 0) {
            this.sendMessages(removalDiffs);
          }
        }
        return;
      }
      case "pong":
        // Ignore pongs
        return;
      case "event": {
        if (!this.networkedDOM) {
          console.error("NetworkedDOM not set on connection that received event", this);
          return;
        }
        const externalId = parsed.connectionId;
        const internalId = this.externalIdToInternalId.get(externalId);
        if (internalId === undefined) {
          this.sendMessage({
            type: "error",
            message: `Event sent with connection id ${parsed.connectionId}, but that connection id has not been connected.`,
          });
          console.error(
            "Connection ID not found in externalIdToInternalId map",
            parsed.connectionId,
          );
          return;
        }

        this.networkedDOM.dispatchRemoteEvent(this, internalId, externalId, {
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
  }

  public handleBufferedMessages() {
    const awaiting = this.messagesAwaitingNetworkedDOM;
    this.messagesAwaitingNetworkedDOM = [];
    for (const message of awaiting) {
      this.handleClientMessage(message);
    }
  }
}
