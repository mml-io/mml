import {
  ClientMessage,
  Diff,
  NodeDescription,
  PongMessage,
  RemoteEvent,
  ServerMessage,
  SnapshotMessage,
} from "@mml-io/networked-dom-protocol";
import {

  ObservableDomInterface,
  ObservableDomMessage,
  ObservableDOMParameters,
  StaticVirtualDomElement,
  StaticVirtualDomMutationIdsRecord,
} from "@mml-io/observable-dom-common";
import { applyPatch } from "rfc6902";

import { StaticVirtualDomMutationRecord, VirtualDOMDiffStruct } from "./common";
import {
  calculateStaticVirtualDomDiff,
  describeNodeWithChildrenForConnectionId,
  diffFromApplicationOfStaticVirtualDomMutationRecordToConnection,
  findParentNodeOfNodeId,
  virtualDOMDiffToVirtualDOMMutationRecord,
} from "./diffing";

export const networkedDomProtocolSubProtocol_v0_1 = "networked-dom-v0.1";
export const defaultWebsocketSubProtocol = networkedDomProtocolSubProtocol_v0_1;

export type ObservableDomFactory = (
  observableDOMParameters: ObservableDOMParameters,
  callback: (message: ObservableDomMessage) => void,
) => ObservableDomInterface;

export class NetworkedDOM {
  // First to last in order of preference
  public static SupportedWebsocketSubProtocolsPreferenceOrder = [
    networkedDomProtocolSubProtocol_v0_1,
  ];

  // Map from the node ids that the DOM uses internally to the node ids that clients refer to.
  private internalNodeIdToClientNodeId = new Map<number, number>();

  // Map from the node ids that clients refer to to the node ids that the DOM uses internally.
  private clientNodeIdToInternalNodeId = new Map<number, number>();

  private nextNodeId = 1;

  private ipcWebsockets = new Set<WebSocket>();
  private currentConnectionId = 1;
  private connectionIdToWebSocketContext = new Map<
    number,
    { webSocket: WebSocket; messageListener: (msg: MessageEvent) => void }
  >();
  private webSocketToConnectionId = new Map<WebSocket, number>();
  private visibleNodeIdsByConnectionId = new Map<number, Set<number>>();
  private initialLoad = true;
  private readonly htmlPath: string;

  private disposed = false;
  private ignoreTextNodes: boolean;

  private documentRoot!: StaticVirtualDomElement;
  private nodeIdToNode = new Map<number, StaticVirtualDomElement>();


  private observableDom: ObservableDomInterface;

  private documentEffectiveStartTime = Date.now();
  private latestDocumentTime = 0;
  private pingCounter = 1;
  private maximumNodeId = 0;



  constructor(
    observableDomFactory: ObservableDomFactory,
    htmlPath: string,
    htmlContents: string,
    oldInstanceDocumentRoot: StaticVirtualDomElement | null,
    onLoad: (domDiff: VirtualDOMDiffStruct | null) => void,
    params = {},
    ignoreTextNodes = true,

  ) {
    this.htmlPath = htmlPath;
    this.ignoreTextNodes = ignoreTextNodes;



    this.observableDom = observableDomFactory(
      {
        htmlPath,
        htmlContents,
        params,
        ignoreTextNodes,
        pingIntervalMilliseconds: 5000,
      },
      (message: ObservableDomMessage) => {
        if (message.documentTime) {
          this.documentEffectiveStartTime = Date.now() - message.documentTime;
          this.latestDocumentTime = message.documentTime;
        }
        if (message.snapshot) {
          this.documentRoot = message.snapshot;
          const clonedSnapshot = JSON.parse(JSON.stringify(message.snapshot));

          if (!this.initialLoad) {
            throw new Error("Received snapshot after initial load");
          }
          this.initialLoad = false;

          let domDiff: VirtualDOMDiffStruct | null = null;
          if (oldInstanceDocumentRoot) {
            domDiff = calculateStaticVirtualDomDiff(oldInstanceDocumentRoot, clonedSnapshot);
            for (const remapping of domDiff.nodeIdRemappings) {
              this.addRemappedNodeId(remapping.clientFacingNodeId, remapping.internalNodeId);
            }
          }



          onLoad(domDiff);
        } else if (message.mutation) {
          if (this.initialLoad) {
            throw new Error("Received mutation before initial load");
          }
          const mutation = this.addKnownNodesInMutation(message.mutation);
          this.processModification(mutation);
          this.removeKnownNodesInMutation(mutation);




        } else {
          if (message.documentTime) {
            // This is just a regular ping message to update the document time - send the document time to all connected clients
            this.sendPings();
            return;
          }
          console.error("Unknown message type from observableDom", message);
        }
      },
    );
  }























  private addRemappedNodeId(clientFacingNodeId: number, internalNodeId: number) {
    this.internalNodeIdToClientNodeId.set(internalNodeId, clientFacingNodeId);
    this.clientNodeIdToInternalNodeId.set(clientFacingNodeId, internalNodeId);
    this.maximumNodeId = Math.max(this.maximumNodeId, Math.max(clientFacingNodeId, internalNodeId));
  }

  private sendPings() {
    const ping = this.pingCounter++;
    if (this.pingCounter > 1000) {
      this.pingCounter = 1;
    }
    const pingMessage: Array<ServerMessage> = [
      {
        type: "ping",
        ping,
        documentTime: this.getDocumentTime(),
      },
    ];
    const stringified = JSON.stringify(pingMessage);
    this.connectionIdToWebSocketContext.forEach((webSocketContext) => {
      webSocketContext.webSocket.send(stringified);
    });
  }

  private getInitialSnapshot(
    connectionId: number,
    documentVirtualDomElement: StaticVirtualDomElement,
  ): SnapshotMessage {
    const visibleNodesForConnection = this.visibleNodeIdsByConnectionId.get(connectionId);
    if (!visibleNodesForConnection) {
      const err = new Error(
        `visibleNodesForConnection not found for connectionId in getInitialSnapshot: ${connectionId}`,
      );
      console.error(err);
      throw err;
    }
    const domSnapshot: NodeDescription | null = describeNodeWithChildrenForConnectionId(
      documentVirtualDomElement,
      connectionId,
      visibleNodesForConnection,
    );
    if (!domSnapshot) {
      throw new Error(`domSnapshot was not generated`);
    }
    return {
      type: "snapshot",
      snapshot: domSnapshot,
      documentTime: Date.now() - this.documentEffectiveStartTime,
    };
  }

  public getDocumentTime(): number {
    return this.latestDocumentTime;
  }

  public addExistingWebsockets(
    websockets: Array<WebSocket>,
    existingWebsocketMap: Map<WebSocket, number> | null,
    domDiff: VirtualDOMDiffStruct | null,
  ) {
    const connectionIds = [];
    for (const websocket of websockets) {
      let existingId = null;
      if (existingWebsocketMap !== null) {
        existingId = existingWebsocketMap.get(websocket);
      }
      const { connectionId } = this.registerWebsocket(websocket, existingId);
      connectionIds.push(connectionId);
    }

    if (domDiff) {
      const diffsByConnectionId = new Map<number, Array<Diff>>(
        connectionIds.map((connectionId) => [connectionId, []]),
      );

      // Each of the websockets needs to have the original state of the document re-applied to it to determine visible
      // nodes, but not sent (they already have the old version of the document as their state).
      for (const connectionId of connectionIds) {
        // Ignore the return value - the side effect is that the visible nodes for the connection are set
        this.getInitialSnapshot(connectionId, domDiff.originalState);
      }

      for (const virtualDOMDiff of domDiff.virtualDOMDiffs) {
        // Convert the diff of the virtual dom data structure to a MutationRecord-like diff and then handle it as if it were a MutationRecord
        // The difficulty here is that the JSON diff is typed by add/remove/replace of elements of a hierarchy specified by paths, but MutationRecords are specified by type of operation and nodeIds

        const mutationRecordLikes = virtualDOMDiffToVirtualDOMMutationRecord(
          domDiff.originalState,
          virtualDOMDiff,
        );

        const patchResults = applyPatch(domDiff.originalState, [virtualDOMDiff]);
        for (const patchResult of patchResults) {
          if (patchResult !== null) {
            console.error("Patching virtual dom structure resulted in error", patchResult);
            throw patchResult;
          }
        }

        for (const mutationRecordLike of mutationRecordLikes) {
          const targetNodeId = mutationRecordLike.target.nodeId;
          const virtualElementParent = findParentNodeOfNodeId(domDiff.originalState, targetNodeId);
          if (!virtualElementParent) {
            throw new Error(`could not find parent node of nodeId ${targetNodeId}`);
          }

          diffsByConnectionId.forEach((diffs, connectionId) => {
            const mutationDiff = diffFromApplicationOfStaticVirtualDomMutationRecordToConnection(
              mutationRecordLike,
              virtualElementParent,
              connectionId,
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              this.visibleNodeIdsByConnectionId.get(connectionId)!,
            );
            if (mutationDiff) {
              diffs.push(mutationDiff);
            }
          });
        }
      }

      diffsByConnectionId.forEach((diffs, connectionId) => {
        if (diffs.length === 0) {
          // Need to add an "empty" message to allow passing the document time to the client
          diffs.push({
            type: "childrenChanged",
            nodeId: this.documentRoot.nodeId,
            previousNodeId: null,
            addedNodes: [],
            removedNodes: [],
          });
        }
        const asServerMessages: Array<ServerMessage> = diffs;
        const firstDiff = diffs[0];
        firstDiff.documentTime = this.getDocumentTime();
        const serializedDiffs = JSON.stringify(asServerMessages, null, 4);
        const webSocketContext = this.connectionIdToWebSocketContext.get(connectionId);
        if (!webSocketContext) {
          throw new Error(`webSocketContext not found in addExistingWebsockets`);
        }
        webSocketContext.webSocket.send(serializedDiffs);
      });
    } else {
      const documentVirtualDomElement = this.documentRoot;
      if (!documentVirtualDomElement) {
        throw new Error(`documentVirtualDomElement not found in getInitialSnapshot`);
      }
      for (const connectionId of connectionIds) {
        const webSocketContext = this.connectionIdToWebSocketContext.get(connectionId);
        if (!webSocketContext) {
          throw new Error(`webSocketContext not found in addExistingWebsockets`);
        }
        const asServerMessages: Array<ServerMessage> = [
          this.getInitialSnapshot(connectionId, documentVirtualDomElement),
        ];
        const serializedSnapshotMessage = JSON.stringify(asServerMessages);
        webSocketContext.webSocket.send(serializedSnapshotMessage);
      }
    }

    for (const connectionId of connectionIds) {
      this.observableDom.addConnectedUserId(connectionId);
    }
  }






    return this.getStaticVirtualDomElementByInternalNodeIdOrThrow(parentNodeId);


  private registerWebsocket(
    webSocket: WebSocket,
    existingConnectionId: number | null = null,
  ): { connectionId: number } {
    let connectionId: number;
    if (existingConnectionId !== null) {
      connectionId = existingConnectionId;
      this.currentConnectionId = Math.max(this.currentConnectionId, connectionId + 1);
    } else {
      connectionId = this.currentConnectionId++;
    }
    const webSocketContext = {
      webSocket,
      messageListener: (msg: MessageEvent) => {
        const string = String(msg.data);
        let parsed;
        try {
          parsed = JSON.parse(string) as ClientMessage;
        } catch (e) {
          console.error(`Error parsing message from websocket: ${string}`);
          console.trace();
          return;
        }

        if (NetworkedDOM.IsPongMessage(parsed)) {
          // Ignore pongs for now
          return;
        }

        this.dispatchRemoteEvent(webSocket, parsed);
      },
    };
    this.connectionIdToWebSocketContext.set(connectionId, webSocketContext);
    this.visibleNodeIdsByConnectionId.set(connectionId, new Set());
    this.webSocketToConnectionId.set(webSocket, connectionId);
    webSocket.addEventListener("message", webSocketContext.messageListener);
    return { connectionId };
  }

  public addIPCWebSocket(webSocket: WebSocket) {
    this.ipcWebsockets.add(webSocket);
    webSocket.addEventListener("close", () => {
      this.ipcWebsockets.delete(webSocket);
    });

    this.observableDom.addIPCWebsocket(webSocket);
  }

  public static handleWebsocketSubprotocol(protocols: Set<string> | Array<string>): string | false {
    const protocolsSet = new Set(protocols);
    // Find highest priority (first in the array) protocol that is supported
    for (const protocol of NetworkedDOM.SupportedWebsocketSubProtocolsPreferenceOrder) {
      if (protocolsSet.has(protocol)) {
        return protocol;
      }
    }
    return false;
  }

  public addWebSocket(webSocket: WebSocket): void {
    if (this.initialLoad) {
      throw new Error("addWebSocket called before initial load - unsupported at this time");
    }
    if (this.disposed) {
      console.error("addWebSocket called on disposed NetworkedDOM");
      throw new Error("This NetworkedDOM has been disposed");
    }

    if (webSocket.protocol) {
      if (
        NetworkedDOM.SupportedWebsocketSubProtocolsPreferenceOrder.indexOf(webSocket.protocol) ===
        -1
      ) {
        const errorMessageString = `Unsupported websocket subprotocol: ${webSocket.protocol}`;
        const errorMessage: Array<ServerMessage> = [
          {
            type: "error",
            message: errorMessageString,
          },
        ];
        webSocket.send(JSON.stringify(errorMessage));
        webSocket.close();
        return;
      }
    } else {
      // TODO - Revisit the default handling of non-protocol websockets. It is easier to debug if a lack of protocol results in an error.
      // Assume for now that this client is a legacy MML client that doesn't send a protocol, but send a warning to the client to encourage specifying a protocol
      const warningMessageString = `No websocket subprotocol specified. Please specify a subprotocol to ensure compatibility with networked-dom servers. Assuming subprotocol "${defaultWebsocketSubProtocol}" for this connection.`;
      const warningMessage: Array<ServerMessage> = [
        {
          type: "warning",
          message: warningMessageString,
        },
      ];
      webSocket.send(JSON.stringify(warningMessage));
    }

    const { connectionId } = this.registerWebsocket(webSocket);
    const documentVirtualDomElement = this.documentRoot;
    if (!documentVirtualDomElement) {
      throw new Error(`documentVirtualDomElement not found in getInitialSnapshot`);
    }
    const asServerMessages: Array<ServerMessage> = [
      this.getInitialSnapshot(connectionId, documentVirtualDomElement),
    ];
    const serializedSnapshotMessage = JSON.stringify(asServerMessages);
    webSocket.send(serializedSnapshotMessage);
    this.observableDom.addConnectedUserId(connectionId);
  }

  public removeWebSocket(webSocket: WebSocket): void {
    const connectionId = this.webSocketToConnectionId.get(webSocket);
    if (!connectionId) {
      return;
    }
    this.observableDom.removeConnectedUserId(connectionId);
    const webSocketContext = this.connectionIdToWebSocketContext.get(connectionId);
    if (!webSocketContext) {
      throw new Error("Missing context for websocket");
    }
    webSocket.removeEventListener("message", webSocketContext.messageListener);
    this.connectionIdToWebSocketContext.delete(connectionId);
    this.visibleNodeIdsByConnectionId.delete(connectionId);
    this.webSocketToConnectionId.delete(webSocket);
  }

  public dispose(): void {
    this.disposed = true;
    for (const [, connectionId] of this.webSocketToConnectionId) {
      this.observableDom.removeConnectedUserId(connectionId);
    }

    // Handle all of the remaining mutations that the disconnections could have caused
    this.observableDom.dispose();

    for (const [webSocket, connectionId] of this.webSocketToConnectionId) {
      const webSocketContext = this.connectionIdToWebSocketContext.get(connectionId);
      if (!webSocketContext) {
        throw new Error("Missing context for websocket");
      }
      webSocket.removeEventListener("message", webSocketContext.messageListener);
      this.connectionIdToWebSocketContext.delete(connectionId);
      this.visibleNodeIdsByConnectionId.delete(connectionId);
      this.webSocketToConnectionId.delete(webSocket);
    }

    for (const ipcWebsocket of this.ipcWebsockets) {
      ipcWebsocket.close();
    }
  }

  private processModification(mutationRecord: StaticVirtualDomMutationRecord): void {
    const documentVirtualDomElement = this.documentRoot;
    if (!documentVirtualDomElement) {
      throw new Error(`document not created in processModification`);
    }

    for (const [, visibleNodesForConnection] of this.visibleNodeIdsByConnectionId) {
      visibleNodesForConnection.add(documentVirtualDomElement.nodeId);
    }

    const diffsByConnectionId = new Map<number, Array<Diff>>(
      Array.from(this.connectionIdToWebSocketContext.keys()).map((connectionId) => [
        connectionId,
        [],
      ]),
    );

    diffsByConnectionId.forEach((diffs, connectionId) => {

      if (mutationRecord.type === "attributes" && !parentNode) {
        console.error("parentNode not found for attribute mutationRecord", mutationRecord);
        console.error("this.documentRoot", JSON.stringify(this.documentRoot, null, 2));
      }
      const diff = diffFromApplicationOfStaticVirtualDomMutationRecordToConnection(
        mutationRecord,
        parentNode,
        connectionId,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.visibleNodeIdsByConnectionId.get(connectionId)!,
      );
      if (diff) {
        diffs.push(diff);
      }
    });

    diffsByConnectionId.forEach((diffs, connectionId) => {
      if (diffs.length > 0) {
        const asServerMessages: Array<ServerMessage> = diffs;
        const serializedDiffs = JSON.stringify(asServerMessages, null, 4);
        const webSocketContext = this.connectionIdToWebSocketContext.get(connectionId);
        if (!webSocketContext) {
          throw new Error(`webSocketContext not found in processModificationList`);
        }
        webSocketContext.webSocket.send(serializedDiffs);
      }
    });
  }

  private removeKnownNodesInMutation(mutation: StaticVirtualDomMutationRecord): void {
    const virtualDomElement = mutation.target;
    if (mutation.type === "childList") {
      mutation.removedNodes.forEach((childDomElement: StaticVirtualDomElement) => {
        this.removeVirtualDomElement(childDomElement);
        const index = virtualDomElement.childNodes.indexOf(childDomElement);
        virtualDomElement.childNodes.splice(index, 1);
      });
      return;
    }
  }

  private removeVirtualDomElement(virtualDomElement: StaticVirtualDomElement): void {
    this.nodeIdToNode.delete(virtualDomElement.nodeId);

    for (const child of virtualDomElement.childNodes) {
      this.removeVirtualDomElement(child);
    }
  }

  static IsPongMessage(message: ClientMessage): message is PongMessage {
    return (message as PongMessage).type === "pong";
  }

  private dispatchRemoteEvent(webSocket: WebSocket, remoteEvent: RemoteEvent): void {
    if (this.disposed) {
      console.error("Cannot dispatch remote event after dispose");
      throw new Error("This NetworkedDOM has been disposed");
    }

    const connectionId = this.webSocketToConnectionId.get(webSocket);
    if (!connectionId) {
      console.error("Unknown web socket dispatched event:", webSocket);
      return;
    }

    const remappedNode = this.clientNodeIdToInternalNodeId.get(remoteEvent.nodeId);
    if (remappedNode) {
      remoteEvent.nodeId = remappedNode;
    }

    const visibleNodes = this.visibleNodeIdsByConnectionId.get(connectionId);
    if (!visibleNodes) {
      console.error("No visible nodes for connection: " + connectionId);
      return;
    }

    if (!visibleNodes.has(remoteEvent.nodeId)) {
      // TODO - do a pass through the hierarchy to determine if this node should be visible to this connection id to prevent clients submitting events for nodes they can't (currently) see
      console.error("Node not visible for connection: " + remoteEvent.nodeId);
      return;
    }

    this.observableDom.dispatchRemoteEventFromConnectionId(connectionId, remoteEvent);
  }

  private getStaticVirtualDomElementByInternalNodeIdOrThrow(
    internalNodeId: number,
  ): StaticVirtualDomElement {
    const remappedId = this.internalNodeIdToClientNodeId.get(internalNodeId);
    if (remappedId !== undefined) {
      const node = this.nodeIdToNode.get(remappedId);
      if (!node) {
        throw new Error("Remapped node not found with nodeId " + remappedId);
      }
      return node;
    }
    const node = this.nodeIdToNode.get(internalNodeId);
    if (!node) {
      throw new Error("Node not found with nodeId:" + internalNodeId);
    }
    return node;
  }

  private addKnownNodesInMutation(
    mutation: StaticVirtualDomMutationIdsRecord,
  ): StaticVirtualDomMutationRecord {
    const target = this.getStaticVirtualDomElementByInternalNodeIdOrThrow(mutation.targetId);

    // TODO - avoid mutation in this conversion - use the attribute pair in the handling (would require changing StaticVirtualDomMutationRecord.attributeName to be the key/value pair).
    if (mutation.attribute) {
      if (mutation.attribute.value !== null) {
        target.attributes[mutation.attribute.attributeName] = mutation.attribute.value;
      } else {
        delete target.attributes[mutation.attribute.attributeName];
      }
    }

    const previousSibling = mutation.previousSiblingId
      ? this.getStaticVirtualDomElementByInternalNodeIdOrThrow(mutation.previousSiblingId)
      : null;

    if (mutation.type === "childList") {
      let index = 0;
      if (previousSibling) {
        index = target.childNodes.indexOf(previousSibling);
        if (index === -1) {
          throw new Error("Previous sibling is not currently a child of the parent element");
        }
        index += 1;
      }
      mutation.addedNodes.forEach((childVirtualDomElement: StaticVirtualDomElement) => {


        if (target.childNodes.indexOf(childVirtualDomElement) === -1) {
          target.childNodes.splice(index, 0, childVirtualDomElement);
          index++;
        }
      });
    } else if (mutation.type === "attributes") {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const attributePair = mutation.attribute!;
      if (attributePair.value === null) {
        delete target.attributes[attributePair.attributeName];
      } else {
        target.attributes[attributePair.attributeName] = attributePair.value;
      }
    } else if (mutation.type === "characterData") {
      // TODO - reimplement characterData
      throw new Error("characterData not supported");
      // virtualDomElement.textContent = targetNode.textContent ? targetNode.textContent : undefined;
    }

    const record: StaticVirtualDomMutationRecord = {
      type: mutation.type,
      target,
      addedNodes: mutation.addedNodes,
      removedNodes: mutation.removedNodeIds.map((nodeId) => {
        return this.getStaticVirtualDomElementByInternalNodeIdOrThrow(nodeId);
      }),
      previousSibling: mutation.previousSiblingId
        ? this.getStaticVirtualDomElementByInternalNodeIdOrThrow(mutation.previousSiblingId)
        : null,
      attributeName: mutation.attribute ? mutation.attribute.attributeName : null,
    };

    return record;
  }

  getSnapshot(): StaticVirtualDomElement {
    return this.documentRoot;
  }


    const remappedNodeId = this.internalNodeIdToClientNodeId.get(node.nodeId);
    if (remappedNodeId !== undefined) {
      node.nodeId = remappedNodeId;
    } else {
      // This id might already refer to a node in this client's view. If so, we need to remap it to a new id.
      const existingClientReference = this.clientNodeIdToInternalNodeId.get(node.nodeId);
      if (existingClientReference) {
        const newNodeId = ++this.maximumNodeId;
        this.addRemappedNodeId(newNodeId, node.nodeId);
        node.nodeId = newNodeId;
      }
    }

    if (this.nodeIdToNode.has(node.nodeId)) {
      throw new Error("Node already exists with id " + node.nodeId);
    }

    this.nodeIdToNode.set(node.nodeId, node);

    this.maximumNodeId = Math.max(this.maximumNodeId, node.nodeId);

    for (const childNode of node.childNodes) {

    }
  }

  public getWebsocketConnectionIdMap() {
    // return a clone of the map
    return new Map(this.webSocketToConnectionId);
  }
}
