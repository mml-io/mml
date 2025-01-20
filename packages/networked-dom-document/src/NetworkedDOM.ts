import {
  BufferWriter,
  encodeAttributesChanged,
  encodeChildrenAdded,
  encodeChildrenRemoved,
  encodeDocumentTime,
  encodePing,
  encodeTextChanged,
  NetworkedDOMV01AttributeChangedDiff,
  NetworkedDOMV01ChildrenChangedDiff,
  NetworkedDOMV01NodeDescription,
  NetworkedDOMV01ServerMessage,
  NetworkedDOMV01SnapshotMessage,
  NetworkedDOMV02AttributesChangedDiff,
  NetworkedDOMV02ChildrenRemovedDiff,
  NetworkedDOMV02Diff,
  NetworkedDOMV02NodeDescription,
  NetworkedDOMV02PingMessage,
  NetworkedDOMV02SnapshotMessage,
  NetworkedDOMV02TextChangedDiff,
} from "@mml-io/networked-dom-protocol";
import {
  LogMessage,
  ObservableDOMInterface,
  ObservableDOMMessage,
  ObservableDOMParameters,
  ObservableDOMRemoteEvent,
  StaticVirtualDOMElement,
  StaticVirtualDOMMutationIdsRecord,
} from "@mml-io/observable-dom-common";

import {
  createNetworkedDOMConnectionForWebsocket,
  SupportedWebsocketSubProtocolsPreferenceOrder,
} from "./createNetworkedDOMConnectionForWebsocket";
import {
  calculateStaticVirtualDOMDiff,
  VirtualDOMDiffStruct,
} from "./diffing/calculateStaticVirtualDOMDiff";
import {
  describeNodeWithChildrenForV01Connection,
  describeNodeWithChildrenForV02Connection,
  hiddenFromAttrName,
  visibleToAttrName,
} from "./diffing/describeNode";
import { listAttributeToSet } from "./diffing/listAttributeToSet";
import { mergeMutations } from "./diffing/mergeMutations";
import { virtualDOMDiffToVirtualDOMMutationRecord } from "./diffing/virtualDOMDiffToVirtualDOMMutationRecord";
import { NetworkedDOMV01Connection } from "./NetworkedDOMV01Connection";
import { NetworkedDOMV02Connection } from "./NetworkedDOMV02Connection";
import { NodeManager } from "./NodeManager";
import {
  applySubjectivityToChildren,
  IsVisibleToAll,
  IsVisibleToAnyOneOfConnectionIds,
  NodeWithSubjectivity,
  Subjectivity,
} from "./NodeWithSubjectivity";
import { applyPatch } from "./rfc6902";
import { VisibilityManager } from "./VisibilityManager";

const VisibleToMode = Symbol("VisibleToMode");
const HiddenFromMode = Symbol("HiddenFromMode");

export type ObservableDOMFactory = (
  observableDOMParameters: ObservableDOMParameters,
  callback: (message: ObservableDOMMessage, observableDOM: ObservableDOMInterface) => void,
) => ObservableDOMInterface;

type PreVisibilityChangeRecords = {
  priorVisibleToV01Connections: Set<NetworkedDOMV01Connection>;
  priorVisibleToV02Connections: Set<NetworkedDOMV02Connection>;
  previousSubjectivity: Subjectivity;
};

/**
 * NetworkedDOM is the main class for the networked-dom-document package. It is responsible for managing the state of
 * the document and the connections to the clients.
 *
 * It is constructed with an ObservableDOMFactory, which is responsible for creating the ObservableDOMInterface
 * implementation that is used to run the document.
 */
export class NetworkedDOM {
  private visibilityManager = new VisibilityManager();
  private nodeManager = new NodeManager(this.visibilityManager);

  private currentConnectionId = 1;

  private connectionIdToNetworkedDOMConnection = new Map<
    number,
    NetworkedDOMV01Connection | NetworkedDOMV02Connection
  >();
  private networkedDOMV01Connections = new Set<NetworkedDOMV01Connection>();
  private networkedDOMV02Connections = new Set<NetworkedDOMV02Connection>();
  private webSocketToNetworkedDOMConnection = new Map<
    WebSocket,
    NetworkedDOMV01Connection | NetworkedDOMV02Connection
  >();

  private initialLoad = true;
  private readonly htmlPath: string;

  private ignoreTextNodes: boolean;

  private documentRoot!: NodeWithSubjectivity;

  private observableDOM: ObservableDOMInterface;

  private documentEffectiveStartTime = Date.now();
  private latestDocumentTime = 0;
  private pingCounter = 1;

  private logCallback?: (message: LogMessage) => void;

  private disposed = false;

  constructor(
    observableDOMFactory: ObservableDOMFactory,
    htmlPath: string,
    htmlContents: string,
    oldInstanceDocumentRoot: StaticVirtualDOMElement | null,
    onLoad: (domDiff: VirtualDOMDiffStruct | null, networkedDOM: NetworkedDOM) => void,
    params = {},
    ignoreTextNodes = true,
    logCallback?: (message: LogMessage) => void,
  ) {
    this.htmlPath = htmlPath;
    this.ignoreTextNodes = ignoreTextNodes;

    this.logCallback = logCallback || this.defaultLogCallback;

    this.observableDOM = observableDOMFactory(
      {
        htmlPath,
        htmlContents,
        params,
        ignoreTextNodes,
        pingIntervalMilliseconds: 5000,
      },
      (message: ObservableDOMMessage, observableDOM: ObservableDOMInterface) => {
        if (this.disposed) {
          return;
        }
        this.observableDOM = observableDOM;
        if (message.documentTime) {
          this.documentEffectiveStartTime = Date.now() - message.documentTime;
          this.latestDocumentTime = message.documentTime;
        }
        if (message.snapshot) {
          const clonedSnapshot = JSON.parse(JSON.stringify(message.snapshot));

          if (!this.initialLoad) {
            throw new Error("Received snapshot after initial load");
          }
          this.initialLoad = false;

          let domDiff: VirtualDOMDiffStruct | null = null;
          if (oldInstanceDocumentRoot) {
            domDiff = calculateStaticVirtualDOMDiff(
              JSON.parse(JSON.stringify(oldInstanceDocumentRoot)),
              clonedSnapshot,
            );
            for (const remapping of domDiff.nodeIdRemappings) {
              this.nodeManager.addRemappedNodeId(
                remapping.clientFacingNodeId,
                remapping.internalNodeId,
              );
            }
            /*
             Use the original document root as the starting state and the diff
             will be applied to it with the connections attached to ensure they
             get the updates
            */
            const [mappedRootNode] = this.nodeManager.addNodeFromInstance(
              JSON.parse(JSON.stringify(oldInstanceDocumentRoot)),
              null,
            );
            this.documentRoot = mappedRootNode;
          } else {
            const [mappedRootNode] = this.nodeManager.addNodeFromInstance(
              JSON.parse(JSON.stringify(message.snapshot)),
              null,
            );
            this.documentRoot = mappedRootNode;
          }

          onLoad(domDiff, this);
        } else if (message.mutations) {
          if (this.initialLoad) {
            throw new Error("Received mutation before initial load");
          }

          const merged = mergeMutations(message.mutations);
          if (merged.length > 1) {
            for (const client of this.networkedDOMV02Connections) {
              client.setBatchStart();
            }
          }
          for (const mutation of merged) {
            this.handleMutation(mutation);
          }
          if (merged.length > 1) {
            for (const client of this.networkedDOMV02Connections) {
              client.setBatchEnd();
            }
          }
        } else if (message.logMessage) {
          if (this.logCallback) {
            this.logCallback(message.logMessage);
          }
        } else {
          if (message.documentTime) {
            // This is just a regular ping message to update the document time - send the document time to all connected clients
            this.sendPings();
            return;
          }
          console.error("Unknown message type from observableDOM", message);
        }
      },
    );
  }

  public static handleWebsocketSubprotocol(protocols: Set<string> | Array<string>): string | false {
    const protocolsSet = new Set(protocols);
    // Find highest priority (first in the array) protocol that is supported
    for (const protocol of SupportedWebsocketSubProtocolsPreferenceOrder) {
      if (protocolsSet.has(protocol)) {
        return protocol;
      }
    }
    return false;
  }

  public addWebSocket(webSocket: WebSocket) {
    const networkedDOMConnection = createNetworkedDOMConnectionForWebsocket(webSocket);
    if (networkedDOMConnection === null) {
      // Error is handled in createNetworkedDOMConnectionForWebsocket
      return;
    }
    this.addNetworkedDOMConnection(networkedDOMConnection);
  }

  public removeWebSocket(webSocket: WebSocket) {
    const networkedDOMConnection = this.webSocketToNetworkedDOMConnection.get(webSocket);
    if (networkedDOMConnection === undefined) {
      throw new Error("Unknown websocket");
    }
    this.removeNetworkedDOMConnection(networkedDOMConnection);
  }

  public addExistingNetworkedDOMConnections(
    networkedDOMConnections: Set<NetworkedDOMV01Connection | NetworkedDOMV02Connection>,
    domDiff: VirtualDOMDiffStruct | null,
  ) {
    for (const networkedDOMConnection of networkedDOMConnections) {
      if (networkedDOMConnection instanceof NetworkedDOMV01Connection) {
        networkedDOMConnection.setNetworkedDOM(this);
        this.networkedDOMV01Connections.add(networkedDOMConnection);
        this.webSocketToNetworkedDOMConnection.set(
          networkedDOMConnection.webSocket,
          networkedDOMConnection,
        );
      } else if (networkedDOMConnection instanceof NetworkedDOMV02Connection) {
        networkedDOMConnection.setNetworkedDOM(this);
        this.webSocketToNetworkedDOMConnection.set(
          networkedDOMConnection.webSocket,
          networkedDOMConnection,
        );
        for (const connectionId of networkedDOMConnection.internalIdToExternalId.keys()) {
          this.connectionIdToNetworkedDOMConnection.set(connectionId, networkedDOMConnection);
        }
        this.networkedDOMV02Connections.add(networkedDOMConnection);
      } else {
        throw new Error("Unknown websocket subprotocol");
      }
    }

    for (const networkedDOMConnection of this.networkedDOMV02Connections) {
      for (const connectionId of networkedDOMConnection.internalIdToExternalId.keys()) {
        if (connectionId >= this.currentConnectionId) {
          this.currentConnectionId = connectionId + 1;
        }
        this.observableDOM.addConnectedUserId(connectionId);
      }
    }

    // Handle v0.1 connections second so that the connection IDs from v0.2 are not reused if a v0.1 connection is only initialized now
    for (const networkedDOMConnection of this.networkedDOMV01Connections) {
      if (networkedDOMConnection.internalConnectionId === null) {
        networkedDOMConnection.initAsNewV01Connection();
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.observableDOM.addConnectedUserId(networkedDOMConnection.internalConnectionId!);
    }

    for (const networkedDOMConnection of this.networkedDOMV02Connections) {
      networkedDOMConnection.handleBufferedMessages();
    }

    if (domDiff) {
      const emptyChildrenChanged: Array<NetworkedDOMV01ServerMessage> = [
        {
          type: "childrenChanged",
          nodeId: this.documentRoot.nodeId,
          previousNodeId: null,
          addedNodes: [],
          removedNodes: [],
          documentTime: this.getDocumentTime(),
        },
      ];
      const encoded = JSON.stringify(emptyChildrenChanged);
      for (const networkedDOMV01Connection of this.networkedDOMV01Connections) {
        networkedDOMV01Connection.sendStringifiedJSONArray(encoded);
      }
      const encodedDocumentTime = encodeDocumentTime({
        type: "documentTime",
        documentTime: this.getDocumentTime(),
      }).getBuffer();
      for (const networkedDOMV02Connection of this.networkedDOMV02Connections) {
        networkedDOMV02Connection.sendEncodedBytes(encodedDocumentTime);
      }

      const virtualDOMDiff = domDiff.virtualDOMDiffs[0];
      if (
        domDiff.virtualDOMDiffs.length === 1 &&
        virtualDOMDiff.op === "replace" &&
        virtualDOMDiff.path === "" &&
        virtualDOMDiff.value.tag === "div" &&
        virtualDOMDiff.value.childNodes.length === 0
      ) {
        // The patch is effectively emptying the document. Remove all nodes from the root
        const rootChildrenIds = this.documentRoot.childNodes.map((child) => child.nodeId);
        this.handleMutation(
          {
            type: "childList",
            targetId: this.documentRoot.nodeId,
            addedNodes: [],
            removedNodeIds: rootChildrenIds,
            previousSiblingId: null,
          },
          false,
        );
      } else {
        for (const virtualDOMDiff of domDiff.virtualDOMDiffs) {
          // Convert the diff of the virtual dom data structure to a MutationRecord-like diff and then handle it as if it were a MutationRecord
          // The difficulty here is that the JSON diff is typed by add/remove/replace of elements of a hierarchy specified by paths, but MutationRecords are specified by type of operation and nodeIds
          const mutationRecordLikes = virtualDOMDiffToVirtualDOMMutationRecord(
            domDiff.originalState,
            virtualDOMDiff,
          );

          if (virtualDOMDiff.path === "" && virtualDOMDiff.op === "replace") {
            // The patch is a snapshot replacement - no need to check the patch validity
          } else {
            const patchResults = applyPatch(domDiff.originalState, [virtualDOMDiff]);
            for (const patchResult of patchResults) {
              if (patchResult !== null) {
                console.error("Patching virtual dom structure resulted in error", patchResult);
                throw patchResult;
              }
            }
          }

          const merged = mergeMutations(mutationRecordLikes);
          for (const mutation of merged) {
            this.handleMutation(mutation, false);
          }
        }
      }
    } else {
      const documentVirtualDOMElement = this.documentRoot;
      if (!documentVirtualDOMElement) {
        throw new Error(`documentVirtualDOMElement not found in getInitialSnapshot`);
      }
      for (const networkedDOMConnection of this.networkedDOMV01Connections) {
        networkedDOMConnection.stringifyAndSendSingleMessage(
          this.getInitialV01Snapshot(networkedDOMConnection, documentVirtualDOMElement),
        );
      }
      for (const networkedDOMConnection of this.networkedDOMV02Connections) {
        networkedDOMConnection.sendMessage(
          this.getInitialV02Snapshot(networkedDOMConnection, documentVirtualDOMElement),
        );
      }
    }
  }

  public addNetworkedDOMConnection(
    networkedDOMConnection: NetworkedDOMV01Connection | NetworkedDOMV02Connection,
  ): void {
    if (this.initialLoad) {
      throw new Error("addWebSocket called before initial load - unsupported at this time");
    }
    if (this.disposed) {
      throw new Error("This NetworkedDOM has been disposed");
    }
    const documentVirtualDOMElement = this.documentRoot;
    if (!documentVirtualDOMElement) {
      throw new Error(`documentVirtualDOMElement not found in getInitialSnapshot`);
    }
    networkedDOMConnection.setNetworkedDOM(this);

    if (networkedDOMConnection instanceof NetworkedDOMV01Connection) {
      if (networkedDOMConnection.internalConnectionId === null) {
        // Create the single connection ID for the client
        networkedDOMConnection.initAsNewV01Connection();
      }
      this.networkedDOMV01Connections.add(networkedDOMConnection);
      this.webSocketToNetworkedDOMConnection.set(
        networkedDOMConnection.webSocket,
        networkedDOMConnection,
      );
      networkedDOMConnection.stringifyAndSendSingleMessage(
        this.getInitialV01Snapshot(networkedDOMConnection, documentVirtualDOMElement),
      );
    } else {
      this.networkedDOMV02Connections.add(networkedDOMConnection);
      this.webSocketToNetworkedDOMConnection.set(
        networkedDOMConnection.webSocket,
        networkedDOMConnection,
      );
      for (const connectionId of networkedDOMConnection.internalIdToExternalId.keys()) {
        this.observableDOM.addConnectedUserId(connectionId);
      }
      networkedDOMConnection.sendMessage(
        this.getInitialV02Snapshot(networkedDOMConnection, documentVirtualDOMElement),
      );
    }
  }

  public removeNetworkedDOMConnection(
    networkedDOMConnection: NetworkedDOMV01Connection | NetworkedDOMV02Connection,
  ): void {
    if (networkedDOMConnection instanceof NetworkedDOMV01Connection) {
      if (!this.networkedDOMV01Connections.has(networkedDOMConnection)) {
        throw new Error("Unrecognized networkedDOMConnection");
      }
      if (networkedDOMConnection.internalConnectionId !== null) {
        this.observableDOM.removeConnectedUserId(networkedDOMConnection.internalConnectionId);
        this.connectionIdToNetworkedDOMConnection.delete(
          networkedDOMConnection.internalConnectionId,
        );
      }
      this.networkedDOMV01Connections.delete(networkedDOMConnection);
      this.webSocketToNetworkedDOMConnection.delete(networkedDOMConnection.webSocket);
      networkedDOMConnection.setNetworkedDOM(null);
    } else if (networkedDOMConnection instanceof NetworkedDOMV02Connection) {
      if (!this.networkedDOMV02Connections.has(networkedDOMConnection)) {
        throw new Error("Unrecognized networkedDOMConnection");
      }
      for (const [internalConnectionId] of networkedDOMConnection.internalIdToExternalId) {
        this.observableDOM.removeConnectedUserId(internalConnectionId);
        this.connectionIdToNetworkedDOMConnection.delete(internalConnectionId);
      }
      this.networkedDOMV02Connections.delete(networkedDOMConnection);
      this.webSocketToNetworkedDOMConnection.delete(networkedDOMConnection.webSocket);
      networkedDOMConnection.setNetworkedDOM(null);
    }
  }

  public connectUsers(
    networkedDOMConnection: NetworkedDOMV01Connection | NetworkedDOMV02Connection,
    addedExternalUserIds: Set<number>,
  ): Map<number, number> {
    const connectionIdToExternalId = new Map<number, number>();
    for (const externalId of addedExternalUserIds) {
      const internalId = this.currentConnectionId++;
      this.connectionIdToNetworkedDOMConnection.set(internalId, networkedDOMConnection);
      connectionIdToExternalId.set(internalId, externalId);
    }
    return connectionIdToExternalId;
  }

  // Called by the connections after storing the mapping of connected users ids
  public announceConnectedUsers(userIds: Set<number>) {
    for (const userId of userIds) {
      this.observableDOM.addConnectedUserId(userId);
    }
  }

  public disconnectUsers(
    networkedDOMConnection: NetworkedDOMV02Connection,
    removedExternalToInternalUserIds: Map<number, number>,
  ): Array<NetworkedDOMV02Diff> {
    const potentiallyAffectedNodeIds = new Set<number>();
    for (const [, removingInternalId] of removedExternalToInternalUserIds) {
      const affectedNodes = this.visibilityManager.getSpecificallyVisibleNodes(removingInternalId);
      if (affectedNodes) {
        for (const nodeId of affectedNodes) {
          potentiallyAffectedNodeIds.add(nodeId);
        }
      }
    }

    for (const nodeId of potentiallyAffectedNodeIds) {
      const node = this.nodeManager.getNode(nodeId);
      if (!node) {
        console.error("node not found", nodeId);
        continue;
      }
      if (
        node.subjectivity != null &&
        !IsVisibleToAnyOneOfConnectionIds(
          node.subjectivity,
          networkedDOMConnection.internalIdToExternalId,
          false,
        )
      ) {
        // If the node isn't visible to this connection anyway then remove it from the map
        potentiallyAffectedNodeIds.delete(nodeId);
      }
    }

    for (const [removingExternalId, removingInternalId] of removedExternalToInternalUserIds) {
      this.observableDOM.removeConnectedUserId(removingInternalId);
      networkedDOMConnection.externalConnectionIds.delete(removingExternalId);
      networkedDOMConnection.externalIdToInternalId.delete(removingExternalId);
      networkedDOMConnection.internalIdToExternalId.delete(removingInternalId);
    }

    // Remove the nodes that are only visible to this connection because of
    // connection ids that are being removed - need to do a fresh
    // determination of visibility because the nodes might have other reasons
    // to be visible to this connection

    const removedMessagesByParent = new Map<number, NetworkedDOMV02ChildrenRemovedDiff>();
    for (const nodeId of potentiallyAffectedNodeIds) {
      const node = this.nodeManager.getNode(nodeId);
      if (!node) {
        console.error("node not found", nodeId);
        continue;
      }
      if (
        node.subjectivity != null &&
        !IsVisibleToAnyOneOfConnectionIds(
          node.subjectivity,
          networkedDOMConnection.internalIdToExternalId,
          false,
        )
      ) {
        // The node is not visible to this connection anymore.
        // The issue now is whether the node might be not visible because a parent visibility was also changed.
        // We can't send removals for children after the parent has already been removed so we need to check if the parent is still visible
        if (
          node.parent != null &&
          (node.parent.subjectivity == null ||
            IsVisibleToAnyOneOfConnectionIds(
              node.parent.subjectivity,
              networkedDOMConnection.internalIdToExternalId,
              false,
            ))
        ) {
          // The parent is still visible so we can send the removal message
          let existingMessage = removedMessagesByParent.get(node.parent.nodeId);
          if (!existingMessage) {
            existingMessage = {
              type: "childrenRemoved",
              nodeId: node.parent.nodeId,
              removedNodes: [],
            };
            removedMessagesByParent.set(node.parent.nodeId, existingMessage);
          }
          existingMessage.removedNodes.push(nodeId);
        }
      }
    }

    return Array.from(removedMessagesByParent.values());
  }

  private defaultLogCallback(message: LogMessage) {
    const getLogFn = (level: string) => {
      switch (level) {
        case "system":
          return console.error;
        case "error":
          return console.error;
        case "warn":
          return console.warn;
        case "log":
          return console.log;
        case "info":
          return console.info;
        default:
          return console.log;
      }
    };

    const logFn = getLogFn(message.level);
    logFn(`${message.level.toUpperCase()} (${this.htmlPath}):`, ...message.content);
  }

  private sendPings() {
    const ping = this.pingCounter++;
    if (this.pingCounter > 1000) {
      this.pingCounter = 1;
    }
    const v01PingMessage: Array<NetworkedDOMV01ServerMessage> = [
      {
        type: "ping",
        ping,
        documentTime: this.getDocumentTime(),
      },
    ];
    const v01Encoded = JSON.stringify(v01PingMessage);
    const v02PingMessage: NetworkedDOMV02PingMessage = {
      type: "ping",
      ping,
      documentTime: this.getDocumentTime(),
    };
    const writer = new BufferWriter(8);
    encodePing(v02PingMessage, writer);
    const v02Encoded = writer.getBuffer();
    this.networkedDOMV01Connections.forEach((networkedDOMConnection) => {
      networkedDOMConnection.webSocket.send(v01Encoded);
    });
    this.networkedDOMV02Connections.forEach((networkedDOMConnection) => {
      networkedDOMConnection.webSocket.send(v02Encoded);
    });
  }

  private getInitialV01Snapshot(
    networkedDOMConnection: NetworkedDOMV01Connection,
    documentVirtualDOMElement: NodeWithSubjectivity,
  ): NetworkedDOMV01SnapshotMessage {
    const domSnapshot: NetworkedDOMV01NodeDescription | null =
      describeNodeWithChildrenForV01Connection(documentVirtualDOMElement, networkedDOMConnection);
    if (!domSnapshot) {
      throw new Error(`domSnapshot was not generated`);
    }
    return {
      type: "snapshot",
      snapshot: domSnapshot,
      documentTime: Date.now() - this.documentEffectiveStartTime,
    };
  }

  private getInitialV02Snapshot(
    networkedDOMConnection: NetworkedDOMV02Connection,
    documentVirtualDOMElement: NodeWithSubjectivity,
  ): NetworkedDOMV02SnapshotMessage {
    const domSnapshot: NetworkedDOMV02NodeDescription | null =
      describeNodeWithChildrenForV02Connection(documentVirtualDOMElement, networkedDOMConnection);
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

  public dispatchRemoteEvent(
    networkedDOMConnection: NetworkedDOMV01Connection | NetworkedDOMV02Connection,
    internalConnectionId: number,
    externalConnectionId: number,
    remoteEvent: ObservableDOMRemoteEvent,
  ): void {
    if (this.disposed) {
      console.error("Cannot dispatch remote event after dispose");
      throw new Error("This NetworkedDOM has been disposed");
    }

    const node = this.nodeManager.getStaticVirtualDOMElementByInternalNodeIdOrThrow(
      remoteEvent.nodeId,
    );
    if (
      !node ||
      !IsVisibleToAnyOneOfConnectionIds(
        node.subjectivity,
        new Map<number, number>([[internalConnectionId, 1]]),
        true,
      )
    ) {
      if (networkedDOMConnection instanceof NetworkedDOMV01Connection) {
        networkedDOMConnection.stringifyAndSendSingleMessage({
          type: "warning",
          message: `Node ${remoteEvent.nodeId} not found or not visible`,
        });
      } else if (networkedDOMConnection instanceof NetworkedDOMV02Connection) {
        networkedDOMConnection.sendMessage({
          type: "warning",
          message: `Node ${remoteEvent.nodeId} not found or not visible to connection ${externalConnectionId}`,
        });
      } else {
        console.error("Unknown networkedDOMConnection type. Cannot send warning.");
      }
      return;
    }

    /*
     The node id sent in the remote event is the client-facing node id (and the
     one used within this class), but the node id might have been remapped from
     the underlying ObservableDOM instance so it needs mapping back
    */
    const remappedNode = this.nodeManager.getInternalRemappedNodeId(remoteEvent.nodeId);
    if (remappedNode) {
      remoteEvent.nodeId = remappedNode;
    }

    this.observableDOM.dispatchRemoteEventFromConnectionId(internalConnectionId, remoteEvent);
  }

  public getSnapshot(): StaticVirtualDOMElement {
    // Need to recreate the snapshot from the current document root because the document root has recursive parent references
    function toStaticVirtualDOMElement(node: NodeWithSubjectivity): StaticVirtualDOMElement {
      const attributes = { ...node.attributes };

      const hasOwnSubjectivity = node.parent && node.subjectivity !== node.parent.subjectivity;
      if (hasOwnSubjectivity) {
        if (node.subjectivity.visibleTo.size > 0) {
          attributes[visibleToAttrName] = Array.from(node.subjectivity.visibleTo).join(" ");
        }
        if (node.subjectivity.hiddenFrom.size > 0) {
          attributes[hiddenFromAttrName] = Array.from(node.subjectivity.hiddenFrom).join(" ");
        }
      }

      return {
        nodeId: node.nodeId,
        tag: node.tag,
        textContent: node.textContent,
        attributes,
        childNodes: node.childNodes.map(toStaticVirtualDOMElement),
      };
    }
    return toStaticVirtualDOMElement(this.documentRoot);
  }

  public dispose(): void {
    this.disposed = true;

    for (const networkedDOMConnection of this.networkedDOMV01Connections) {
      networkedDOMConnection.setNetworkedDOM(null);
    }
    for (const networkedDOMConnection of this.networkedDOMV02Connections) {
      networkedDOMConnection.setNetworkedDOM(null);
    }

    // Handle all of the remaining mutations that the disconnections could have caused
    this.observableDOM.dispose();
  }

  private handleAddedNodes(
    targetId: number,
    previousSiblingId: number | null,
    addedNodes: Array<StaticVirtualDOMElement>,
  ) {
    const target = this.nodeManager.getStaticVirtualDOMElementByInternalNodeIdOrThrow(targetId);
    if (!target) {
      console.error("Target node not found for mutation", targetId);
      return;
    }

    let hasSubjectiveChildren = false; // true if childrenChanged and children have visibleTo or hiddenFrom

    let previousNodeIdIsSubjectiveForV01 = false;
    let previousNodeIdIsSubjectiveForV02 = false;
    const parentIsSubjectiveForV01 =
      target.subjectivity != null && !IsVisibleToAll(target.subjectivity, true);
    const parentIsSubjectiveForV02 =
      target.subjectivity != null && !IsVisibleToAll(target.subjectivity, false);

    const addedNodesWithSubjectivity: Array<NodeWithSubjectivity> = [];

    let previousNode: NodeWithSubjectivity | null = null;
    let previousNodeIndex = -1;
    if (previousSiblingId != null) {
      previousNode =
        this.nodeManager.getStaticVirtualDOMElementByInternalNodeIdOrThrow(previousSiblingId) ||
        null;
      if (!previousNode) {
        throw new Error("previous node not found: " + previousSiblingId);
      } else {
        previousNodeIdIsSubjectiveForV01 =
          previousNode.subjectivity != null && !IsVisibleToAll(previousNode.subjectivity, true);
        previousNodeIdIsSubjectiveForV02 =
          previousNode.subjectivity != null && !IsVisibleToAll(previousNode.subjectivity, false);
        for (let i = 0; i < target.childNodes.length; i++) {
          const child = target.childNodes[i];
          if (child.nodeId === previousNode.nodeId) {
            previousNodeIndex = i;
            break;
          }
        }
      }
    }

    for (const addedNode of addedNodes) {
      const [addedNodeWithSubjectivity, addedNodeHasSubjectivity] =
        this.nodeManager.addNodeFromInstance(addedNode, target);
      if (addedNodeHasSubjectivity) {
        hasSubjectiveChildren = true;
      }
      if (addedNodeWithSubjectivity != null) {
        addedNodesWithSubjectivity.push(addedNodeWithSubjectivity);
      }
    }

    if (previousNode !== null) {
      // The previousNodeId is present, so we need to insert the addedNodes after the previousNode

      let index = previousNodeIndex + 1;
      for (const childVirtualDOMElement of addedNodesWithSubjectivity) {
        target.childNodes.splice(index, 0, childVirtualDOMElement);
        index++;
      }
    } else {
      // The previousNodeId is not present, so we need to prepend the addedNodes
      target.childNodes = addedNodesWithSubjectivity.concat(target.childNodes);
    }

    // v01 connections
    if (parentIsSubjectiveForV01 || hasSubjectiveChildren || previousNodeIdIsSubjectiveForV01) {
      // Need to go through each connection and project the children that should be visible to that connection

      for (const client of this.networkedDOMV01Connections) {
        const canSeeParent =
          target.subjectivity == null ||
          IsVisibleToAnyOneOfConnectionIds(
            target.subjectivity,
            client.internalIdToExternalId,
            true,
          );
        if (!canSeeParent) {
          break;
        }
        let projectedPreviousNodeId: number | null = null;
        if (previousNode != null) {
          if (previousNodeIdIsSubjectiveForV01) {
            // Go in reverse from the previousNodeIndex to the start of the children to see which of them this connection can see.
            // If we reach the start of the children, then send without the previousNodeId to tell the connection to put it at the start

            for (let i = previousNodeIndex; i >= 0; i--) {
              const child = target.childNodes[i];
              if (
                child.subjectivity == null ||
                IsVisibleToAnyOneOfConnectionIds(
                  child.subjectivity,
                  client.internalIdToExternalId,
                  true,
                )
              ) {
                projectedPreviousNodeId = child.nodeId;
                break;
              }
            }
          } else {
            projectedPreviousNodeId = previousNode.nodeId;
          }
        }
        const projectedChildren: Array<NetworkedDOMV01NodeDescription> = [];
        for (const addedNode of addedNodesWithSubjectivity) {
          if (
            addedNode.subjectivity == null ||
            IsVisibleToAnyOneOfConnectionIds(
              addedNode.subjectivity,
              client.internalIdToExternalId,
              true,
            )
          ) {
            const node = describeNodeWithChildrenForV01Connection(addedNode, client);
            if (node != null) {
              projectedChildren.push(node);
            }
          }
        }
        if (projectedChildren.length > 0) {
          client.stringifyAndSendSingleMessage({
            type: "childrenChanged",
            nodeId: target.nodeId,
            previousNodeId: projectedPreviousNodeId,
            addedNodes: projectedChildren,
            removedNodes: [],
          });
        }
      }
    } else {
      if (this.networkedDOMV01Connections.size > 0) {
        const projectedChildren: Array<NetworkedDOMV01NodeDescription> = [];
        for (const addedNode of addedNodesWithSubjectivity) {
          const node = describeNodeWithChildrenForV01Connection(addedNode, null);
          if (node !== null) {
            projectedChildren.push(node);
          }
        }
        const reprojectedMsg: NetworkedDOMV01ChildrenChangedDiff = {
          type: "childrenChanged",
          nodeId: target.nodeId,
          previousNodeId: previousNode ? previousNode.nodeId : null,
          addedNodes: projectedChildren,
          removedNodes: [],
        };
        const encoded = JSON.stringify([reprojectedMsg]);

        // forward to all clients as all clients should see this change
        for (const client of this.networkedDOMV01Connections) {
          client.sendStringifiedJSONArray(encoded);
        }
      }
    }

    // v02 connections
    if (parentIsSubjectiveForV02 || hasSubjectiveChildren || previousNodeIdIsSubjectiveForV02) {
      // Need to go through each connection and project the children that should be visible to that connection

      for (const client of this.networkedDOMV02Connections) {
        const canSeeParent =
          target.subjectivity == null ||
          IsVisibleToAnyOneOfConnectionIds(
            target.subjectivity,
            client.internalIdToExternalId,
            false,
          );
        if (!canSeeParent) {
          break;
        }
        let projectedPreviousNodeId: number | null = null;
        if (previousNode != null) {
          if (previousNodeIdIsSubjectiveForV02) {
            // Go in reverse from the previousNodeIndex to the start of the children to see which of them this connection can see.
            // If we reach the start of the children, then send without the previousNodeId to tell the connection to put it at the start

            for (let i = previousNodeIndex; i >= 0; i--) {
              const child = target.childNodes[i];
              if (
                child.subjectivity == null ||
                IsVisibleToAnyOneOfConnectionIds(
                  child.subjectivity,
                  client.internalIdToExternalId,
                  false,
                )
              ) {
                projectedPreviousNodeId = child.nodeId;
                break;
              }
            }
          } else {
            projectedPreviousNodeId = previousNode.nodeId;
          }
        }
        const projectedChildren: Array<NetworkedDOMV02NodeDescription> = [];
        for (const addedNode of addedNodesWithSubjectivity) {
          if (
            addedNode.subjectivity == null ||
            IsVisibleToAnyOneOfConnectionIds(
              addedNode.subjectivity,
              client.internalIdToExternalId,
              false,
            )
          ) {
            const node = describeNodeWithChildrenForV02Connection(addedNode, client);
            if (node != null) {
              projectedChildren.push(node);
            }
          }
        }
        if (projectedChildren.length > 0) {
          client.sendMessage({
            type: "childrenAdded",
            nodeId: target.nodeId,
            previousNodeId: projectedPreviousNodeId === null ? 0 : projectedPreviousNodeId,
            addedNodes: projectedChildren,
          });
        }
      }
    } else {
      const projectedChildren: Array<NetworkedDOMV02NodeDescription> = [];
      for (const addedNode of addedNodesWithSubjectivity) {
        const node = describeNodeWithChildrenForV02Connection(addedNode, null);
        if (node != null) {
          projectedChildren.push(node);
        }
      }
      const encoded = encodeChildrenAdded({
        type: "childrenAdded",
        nodeId: target.nodeId,
        previousNodeId: previousNode === null ? 0 : previousNode.nodeId,
        addedNodes: projectedChildren,
      }).getBuffer();
      for (const client of this.networkedDOMV02Connections) {
        client.sendEncodedBytes(encoded);
      }
    }
  }

  private handleRemovedNodes(targetId: number, removedNodeIds: Array<number>) {
    const node = this.nodeManager.getStaticVirtualDOMElementByInternalNodeIdOrThrow(targetId);
    if (!node) {
      console.error("Target node not found for mutation", targetId);
      return;
    }

    const parentIsSubjectiveForV01 =
      node.subjectivity != null && !IsVisibleToAll(node.subjectivity, true);
    let anyChildIsSubjectiveForV01 = false;
    const parentIsSubjectiveForV02 =
      node.subjectivity != null && !IsVisibleToAll(node.subjectivity, false);
    let anyChildIsSubjectiveForV02 = false;

    const removedSet = new Set(removedNodeIds);

    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (removedSet.has(child.nodeId)) {
        if (child.subjectivity != null && !IsVisibleToAll(child.subjectivity, true)) {
          anyChildIsSubjectiveForV01 = true;
        }
        if (child.subjectivity != null && !IsVisibleToAll(child.subjectivity, false)) {
          anyChildIsSubjectiveForV02 = true;
        }
        node.childNodes.splice(i, 1);
        break;
      }
    }

    // v01 connections
    if (parentIsSubjectiveForV01 || anyChildIsSubjectiveForV01) {
      // Need to go through each connection and project the children
      for (const client of this.networkedDOMV01Connections) {
        const removableChildren = [];
        for (const removedNodeId of removedNodeIds) {
          const child =
            this.nodeManager.getStaticVirtualDOMElementByInternalNodeIdOrThrow(removedNodeId);
          if (!child) {
            throw new Error("Child not found for removed node id: " + removedNodeId);
          }
          if (
            child.subjectivity == null ||
            IsVisibleToAnyOneOfConnectionIds(
              child.subjectivity,
              client.internalIdToExternalId,
              true,
            )
          ) {
            removableChildren.push(removedNodeId);
          }
        }
        if (removableChildren.length > 0) {
          client.stringifyAndSendSingleMessage({
            type: "childrenChanged",
            nodeId: node.nodeId,
            addedNodes: [],
            previousNodeId: null,
            removedNodes: removableChildren,
          });
        }
      }
    } else {
      if (this.networkedDOMV01Connections.size > 0) {
        const msg: NetworkedDOMV01ChildrenChangedDiff = {
          type: "childrenChanged",
          nodeId: node.nodeId,
          addedNodes: [],
          previousNodeId: null,
          removedNodes: removedNodeIds,
        };
        const encoded = JSON.stringify([msg]);
        for (const client of this.networkedDOMV01Connections) {
          client.sendStringifiedJSONArray(encoded);
        }
      }
    }

    // v02 connections
    if (parentIsSubjectiveForV02 || anyChildIsSubjectiveForV02) {
      // Need to go through each connection and project the children
      for (const client of this.networkedDOMV02Connections) {
        const removableChildren = [];
        for (const removedNodeId of removedNodeIds) {
          const child =
            this.nodeManager.getStaticVirtualDOMElementByInternalNodeIdOrThrow(removedNodeId);
          if (!child) {
            throw new Error("Child not found for removed node id: " + removedNodeId);
          }
          if (
            child.subjectivity == null ||
            IsVisibleToAnyOneOfConnectionIds(
              child.subjectivity,
              client.internalIdToExternalId,
              false,
            )
          ) {
            removableChildren.push(removedNodeId);
          }
        }
        if (removableChildren.length > 0) {
          client.sendMessage({
            type: "childrenRemoved",
            nodeId: node.nodeId,
            removedNodes: removableChildren,
          });
        }
      }
    } else {
      // forward to all clients
      const msg: NetworkedDOMV02ChildrenRemovedDiff = {
        type: "childrenRemoved",
        nodeId: node.nodeId,
        removedNodes: removedNodeIds,
      };
      const encoded = encodeChildrenRemoved(msg).getBuffer();
      for (const client of this.networkedDOMV02Connections) {
        client.sendEncodedBytes(encoded);
      }
    }

    // Only delete the children from the nodeIdMap once we have finished projecting the children
    for (const removedNodeId of removedNodeIds) {
      this.removeNodeAndChildren(removedNodeId);
    }
  }

  private handleAttributeMutation(
    targetId: number,
    attributes: {
      [p: string]: string | null;
    },
  ) {
    const target = this.nodeManager.getStaticVirtualDOMElementByInternalNodeIdOrThrow(targetId);
    if (!target) {
      console.error("Target node not found for mutation", targetId);
      return;
    }

    const resultAttributes: { [key: string]: string | null } = {};
    for (const [key, value] of Object.entries(attributes)) {
      if (key === visibleToAttrName) {
        const hasOwnSubjectivity = target.subjectivity !== target.parent?.subjectivity;
        const previousSet = hasOwnSubjectivity ? target.subjectivity.visibleTo : new Set<number>();
        const newVisibleTo = listAttributeToSet(value);
        const added = new Set(Array.from(newVisibleTo).filter((x) => !previousSet.has(x)));
        const removed = new Set(Array.from(previousSet).filter((x) => !newVisibleTo.has(x)));
        this.handleVisibleToChange(targetId, added, removed);
        continue;
      }
      if (key === hiddenFromAttrName) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const hasOwnSubjectivity = target.subjectivity !== target.parent!.subjectivity;
        const previousSet = hasOwnSubjectivity ? target.subjectivity.hiddenFrom : new Set<number>();
        const newHiddenFrom = listAttributeToSet(value);
        const added = new Set(Array.from(newHiddenFrom).filter((x) => !previousSet.has(x)));
        const removed = new Set(Array.from(previousSet).filter((x) => !newHiddenFrom.has(x)));
        this.handleHiddenFromChange(targetId, added, removed);
        continue;
      }
      const existingAttribute = target.attributes[key];
      if (value !== null) {
        if (existingAttribute === value) {
          // Already set to this value - don't need to set again
          continue;
        }
      } else {
        if (existingAttribute === undefined) {
          // Already unset - don't need to unset again
          continue;
        }
      }
      resultAttributes[key] = value;
    }

    if (Object.keys(resultAttributes).length > 0) {
      // There are attribute changes other than visible-to and hidden-from
      this.handleAttributeChange(targetId, resultAttributes);
    }
  }

  private handleAttributeChange(targetId: number, attributes: { [key: string]: string | null }) {
    const node = this.nodeManager.getStaticVirtualDOMElementByInternalNodeIdOrThrow(targetId);
    if (!node) {
      console.error("Target node not found for mutation", targetId);
      return;
    }

    const nodeIsSubjectiveForV01 =
      node.subjectivity != null && !IsVisibleToAll(node.subjectivity, true);
    const nodeIsSubjectiveForV02 =
      node.subjectivity != null && !IsVisibleToAll(node.subjectivity, false);

    for (const [attributeName, value] of Object.entries(attributes)) {
      if (value !== null) {
        node.attributes[attributeName] = value;
      } else {
        delete node.attributes[attributeName];
      }
    }

    // v01 connections
    if (this.networkedDOMV01Connections.size > 0) {
      const allMessages: Array<NetworkedDOMV01ServerMessage> = [];

      for (const [attributeName, value] of Object.entries(attributes)) {
        const reprojectedMsg: NetworkedDOMV01AttributeChangedDiff = {
          type: "attributeChange",
          nodeId: node.nodeId,
          attribute: attributeName,
          newValue: value,
        };
        allMessages.push(reprojectedMsg);
      }
      const encoded = JSON.stringify(allMessages);
      if (nodeIsSubjectiveForV01) {
        for (const client of this.networkedDOMV01Connections) {
          const canSee =
            node.subjectivity == null ||
            IsVisibleToAnyOneOfConnectionIds(
              node.subjectivity,
              client.internalIdToExternalId,
              true,
            );
          if (canSee) {
            client.sendStringifiedJSONArray(encoded);
          }
        }
      } else {
        // forward to interested clients
        for (const client of this.networkedDOMV01Connections) {
          client.sendStringifiedJSONArray(encoded);
        }
      }
    }

    const message: NetworkedDOMV02AttributesChangedDiff = {
      type: "attributesChanged",
      nodeId: node.nodeId,
      attributes: Object.entries(attributes).map(([attribute, value]) => [attribute, value]),
    };
    const encoded = encodeAttributesChanged(message).getBuffer();

    // v02 connections
    if (nodeIsSubjectiveForV02) {
      for (const client of this.networkedDOMV02Connections) {
        const canSee =
          node.subjectivity == null ||
          IsVisibleToAnyOneOfConnectionIds(node.subjectivity, client.internalIdToExternalId, false);
        if (canSee) {
          client.sendEncodedBytes(encoded);
        }
      }
    } else {
      // forward to all clients
      for (const client of this.networkedDOMV02Connections) {
        client.sendEncodedBytes(encoded);
      }
    }
  }

  private handleVisibleToChange(targetId: number, added: Set<number>, removed: Set<number>) {
    const node = this.nodeManager.getStaticVirtualDOMElementByInternalNodeIdOrThrow(targetId);
    if (!node) {
      console.error("Target node not found for mutation", targetId);
      return;
    }

    if (node.parent == null) {
      // TODO - handle/reject changeVisibleTo for root node
      return;
    }
    const previousSubjectivity = node.subjectivity;

    const visibilityRecords = this.calculatePreVisibilityChangeRecords(node);

    for (const internalConnectionId of removed) {
      this.visibilityManager.removeSpecificallyVisibleNode(internalConnectionId, node.nodeId);
    }
    const newVisibleTo = new Set<number>();
    for (const internalConnectionId of added) {
      newVisibleTo.add(internalConnectionId);

      this.visibilityManager.addSpecificallyVisibleNode(internalConnectionId, node.nodeId);
    }

    const hasNonInheritedSubjectivity =
      previousSubjectivity != null && previousSubjectivity !== node.parent.subjectivity;
    if (hasNonInheritedSubjectivity) {
      // This node had its own list of visibleTo connections, so we need to re-add the ids that are not being removed
      for (const connectionId of previousSubjectivity.visibleTo) {
        if (!removed.has(connectionId)) {
          newVisibleTo.add(connectionId);
        }
      }
    }

    if (hasNonInheritedSubjectivity) {
      // If the node has its own subjectivity then it is not inherited and the children already point to this node's subjectivity as their ancestor
      node.subjectivity.visibleTo = newVisibleTo;
      if (newVisibleTo.size === 0 && node.subjectivity.hiddenFrom.size === 0) {
        // This node's subjectivity has no effect so we can remove it and replace it with the parent's subjectivity
        if (!node.subjectivity.ancestorSubjectivity) {
          throw new Error("Expected ancestorSubjectivity to be set");
        }
        node.subjectivity = node.subjectivity.ancestorSubjectivity;
        applySubjectivityToChildren(node, node.subjectivity, previousSubjectivity);
      }
    } else {
      // If this node uses the same subjectivity as the parent then it is inherited and needs its own which is then applied to all children
      const newSubjectivity: Subjectivity = {
        visibleTo: newVisibleTo,
        hiddenFrom: new Set<number>(),
        ancestorSubjectivity: previousSubjectivity, // The previous subjectivity is that of the parent/ancestor
      };
      node.subjectivity = newSubjectivity;
      applySubjectivityToChildren(node, newSubjectivity, previousSubjectivity);
    }

    this.applyVisibilityAfterChanges(node, visibilityRecords, added, removed, VisibleToMode);
  }

  private handleHiddenFromChange(targetId: number, added: Set<number>, removed: Set<number>) {
    const node = this.nodeManager.getStaticVirtualDOMElementByInternalNodeIdOrThrow(targetId);
    if (!node) {
      console.error("Target node not found for mutation", targetId);
      return;
    }

    if (node.parent == null) {
      // TODO - handle/reject changeVisibleTo for root node
      return;
    }

    const previousSubjectivity = node.subjectivity;

    const visibilityRecords = this.calculatePreVisibilityChangeRecords(node);

    const newHiddenFrom = new Set<number>();
    for (const connectionId of added) {
      newHiddenFrom.add(connectionId);
    }

    const hasNonInheritedSubjectivity =
      previousSubjectivity !== null && previousSubjectivity !== node.parent.subjectivity;
    if (hasNonInheritedSubjectivity) {
      // This node had its own list of hiddenFrom connections, so we need to re-add the ids that are not being removed
      for (const connectionId of previousSubjectivity.hiddenFrom) {
        if (!removed.has(connectionId)) {
          newHiddenFrom.add(connectionId);
        }
      }
    }

    if (hasNonInheritedSubjectivity) {
      // If the node has its own subjectivity then it is not inherited and the children already point to this node's subjectivity as their ancestor
      node.subjectivity.hiddenFrom = newHiddenFrom;
      if (newHiddenFrom.size === 0 && node.subjectivity.visibleTo.size === 0) {
        // This node's subjectivity has no effect so we can remove it and replace it with the parent's subjectivity
        if (!node.subjectivity.ancestorSubjectivity) {
          throw new Error("Expected ancestorSubjectivity to be set");
        }
        node.subjectivity = node.subjectivity.ancestorSubjectivity;
        applySubjectivityToChildren(node, node.subjectivity, previousSubjectivity);
      }
    } else {
      // If this node uses the same subjectivity as the parent then it is inherited and needs its own which is then applied to all children
      const newSubjectivity: Subjectivity = {
        hiddenFrom: newHiddenFrom,
        visibleTo: new Set<number>(),
        ancestorSubjectivity: previousSubjectivity, // The previous subjectivity is that of the parent/ancestor
      };
      node.subjectivity = newSubjectivity;
      applySubjectivityToChildren(node, newSubjectivity, previousSubjectivity);
    }

    this.applyVisibilityAfterChanges(node, visibilityRecords, added, removed, HiddenFromMode);
  }

  private handleCharacterData(targetId: number, textContent: string) {
    const node = this.nodeManager.getStaticVirtualDOMElementByInternalNodeIdOrThrow(targetId);
    if (!node) {
      console.error("Target node not found for mutation", targetId);
      return;
    }

    const nodeIsSubjectiveForV01 =
      node.subjectivity != null && !IsVisibleToAll(node.subjectivity, true);
    const nodeIsSubjectiveForV02 =
      node.subjectivity != null && !IsVisibleToAll(node.subjectivity, false);

    node.textContent = textContent;

    // v01 connections
    if (this.networkedDOMV01Connections.size > 0) {
      const allMessages: Array<NetworkedDOMV01ServerMessage> = [
        {
          type: "textChanged",
          nodeId: node.nodeId,
          text: textContent,
        },
      ];
      const encoded = JSON.stringify(allMessages);
      if (nodeIsSubjectiveForV01) {
        for (const client of this.networkedDOMV01Connections) {
          const canSee =
            node.subjectivity == null ||
            IsVisibleToAnyOneOfConnectionIds(
              node.subjectivity,
              client.internalIdToExternalId,
              true,
            );
          if (canSee) {
            client.sendStringifiedJSONArray(encoded);
          }
        }
      } else {
        // forward to interested clients
        for (const client of this.networkedDOMV01Connections) {
          client.sendStringifiedJSONArray(encoded);
        }
      }
    }

    const message: NetworkedDOMV02TextChangedDiff = {
      type: "textChanged",
      nodeId: node.nodeId,
      text: textContent,
    };
    const encoded = encodeTextChanged(message).getBuffer();

    // v02 connections
    if (nodeIsSubjectiveForV02) {
      for (const client of this.networkedDOMV02Connections) {
        const canSee =
          node.subjectivity == null ||
          IsVisibleToAnyOneOfConnectionIds(node.subjectivity, client.internalIdToExternalId, false);
        if (canSee) {
          client.sendEncodedBytes(encoded);
        }
      }
    } else {
      // forward to all clients
      for (const client of this.networkedDOMV02Connections) {
        client.sendEncodedBytes(encoded);
      }
    }
  }

  private calculatePreVisibilityChangeRecords(
    node: NodeWithSubjectivity,
  ): PreVisibilityChangeRecords {
    const priorVisibleToV01Connections = new Set<NetworkedDOMV01Connection>();
    const priorVisibleToV02Connections = new Set<NetworkedDOMV02Connection>();
    const previousSubjectivity = node.subjectivity;

    // Need to work out which connections can currently see this element and which ones will see it after the change
    for (const client of this.networkedDOMV01Connections) {
      const canSee =
        previousSubjectivity == null ||
        IsVisibleToAnyOneOfConnectionIds(previousSubjectivity, client.internalIdToExternalId, true);
      if (canSee) {
        priorVisibleToV01Connections.add(client);
      }
    }

    // Need to work out which connections can currently see this element and which ones will see it after the change
    for (const client of this.networkedDOMV02Connections) {
      const canSee =
        previousSubjectivity == null ||
        IsVisibleToAnyOneOfConnectionIds(
          previousSubjectivity,
          client.internalIdToExternalId,
          false,
        );
      if (canSee) {
        priorVisibleToV02Connections.add(client);
      }
    }

    return {
      priorVisibleToV01Connections,
      priorVisibleToV02Connections,
      previousSubjectivity,
    };
  }

  private applyVisibilityAfterChanges(
    node: NodeWithSubjectivity,
    preVisibilityChangeRecords: PreVisibilityChangeRecords,
    added: Set<number>,
    removed: Set<number>,
    mode: typeof VisibleToMode | typeof HiddenFromMode,
  ) {
    const priorVisibleToV01Connections = preVisibilityChangeRecords.priorVisibleToV01Connections;
    const priorVisibleToV02Connections = preVisibilityChangeRecords.priorVisibleToV02Connections;

    if (!node.parent) {
      throw new Error("Cannot apply visibility changes to root node");
    }

    const nodeId = node.nodeId;
    let childIndex = -1;
    for (let i = 0; i < node.parent.childNodes.length; i++) {
      const child = node.parent.childNodes[i];
      if (child.nodeId === nodeId) {
        childIndex = i;
        break;
      }
    }

    let previousNodeId = 0;
    let previousNodeIndex: number | null = null;
    let previousNodeIsSubjectiveForV01 = false;
    let previousNodeIsSubjectiveForV02 = false;
    if (childIndex > 0) {
      previousNodeIndex = childIndex - 1;
      const previousNode = node.parent.childNodes[childIndex - 1];
      previousNodeId = previousNode.nodeId;
      previousNodeIsSubjectiveForV01 =
        previousNode.subjectivity != null && !IsVisibleToAll(previousNode.subjectivity, true);
      previousNodeIsSubjectiveForV02 =
        previousNode.subjectivity != null && !IsVisibleToAll(previousNode.subjectivity, false);
    }

    if (this.networkedDOMV01Connections.size > 0) {
      const removedMessage: NetworkedDOMV01ChildrenChangedDiff = {
        type: "childrenChanged",
        nodeId: node.parent.nodeId,
        previousNodeId: null,
        removedNodes: [node.nodeId],
        addedNodes: [],
      };
      const encodedRemoved = JSON.stringify([removedMessage]);

      for (const client of this.networkedDOMV01Connections) {
        const canSee =
          node.subjectivity == null ||
          IsVisibleToAnyOneOfConnectionIds(node.subjectivity, client.internalIdToExternalId, true);
        const couldSeePreviously = priorVisibleToV01Connections.has(client);
        if (canSee && !couldSeePreviously) {
          // The client could not see the node before but can now - add it

          let previousNodeIdForClient = previousNodeId;
          if (previousNodeId !== 0) {
            // If the previous node is subjective then we need to determine which previousNode this connection can see
            if (previousNodeIsSubjectiveForV01) {
              // Go in reverse from the previousNodeIndex to the start of the children to see which of them this connection can see.
              // If we reach the start of the children, then send without the previousNodeId to tell the connection to put it at the start
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              for (let i = previousNodeIndex!; i >= 0; i--) {
                const child = node.parent.childNodes[i];
                if (
                  child.subjectivity == null ||
                  IsVisibleToAnyOneOfConnectionIds(
                    child.subjectivity,
                    client.internalIdToExternalId,
                    true,
                  )
                ) {
                  previousNodeIdForClient = child.nodeId;
                  break;
                }
              }
            } else {
              previousNodeIdForClient = previousNodeId;
            }
          }

          let previousNodeIdPointer: number | null = previousNodeIdForClient;
          if (previousNodeIdForClient === 0) {
            previousNodeIdPointer = null;
          }
          client.stringifyAndSendSingleMessage({
            type: "childrenChanged",
            nodeId: node.parent.nodeId,
            previousNodeId: previousNodeIdPointer,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            addedNodes: [describeNodeWithChildrenForV01Connection(node, client)!],
            removedNodes: [],
          });
        } else if (!canSee && couldSeePreviously) {
          // The client could see the node before but can't now - remove it
          client.sendStringifiedJSONArray(encodedRemoved);
        } else if (canSee && couldSeePreviously) {
          // The client could see the node before and can still see it - do nothing
        } else if (!canSee && !couldSeePreviously) {
          // The client could not see the node before and still can't - do nothing
        }
      }
    }

    if (this.networkedDOMV02Connections.size > 0) {
      const removedMessage: NetworkedDOMV02ChildrenRemovedDiff = {
        type: "childrenRemoved",
        nodeId: node.parent.nodeId,
        removedNodes: [node.nodeId],
      };
      const encodedRemoved = encodeChildrenRemoved(removedMessage).getBuffer();
      for (const client of this.networkedDOMV02Connections) {
        const canSee =
          node.subjectivity == null ||
          IsVisibleToAnyOneOfConnectionIds(node.subjectivity, client.internalIdToExternalId, false);
        const couldSeePreviously = priorVisibleToV02Connections.has(client);
        if (canSee && !couldSeePreviously) {
          // The client could not see the node before but can now - add it

          let previousNodeIdForClient = previousNodeId;
          if (previousNodeId !== 0) {
            // If the previous node is subjective then we need to determine which previousNode this connection can see
            if (previousNodeIsSubjectiveForV02) {
              // Go in reverse from the previousNodeIndex to the start of the children to see which of them this connection can see.
              // If we reach the start of the children, then send without the previousNodeId to tell the connection to put it at the start
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              for (let i = previousNodeIndex!; i >= 0; i--) {
                const child = node.parent.childNodes[i];
                if (
                  child.subjectivity == null ||
                  IsVisibleToAnyOneOfConnectionIds(
                    child.subjectivity,
                    client.internalIdToExternalId,
                    false,
                  )
                ) {
                  previousNodeIdForClient = child.nodeId;
                  break;
                }
              }
            } else {
              previousNodeIdForClient = previousNodeId;
            }
          }

          client.sendMessage({
            type: "childrenAdded",
            nodeId: node.parent.nodeId,
            previousNodeId: previousNodeIdForClient,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            addedNodes: [describeNodeWithChildrenForV02Connection(node, client)!],
          });
        } else if (!canSee && couldSeePreviously) {
          // The client could see the node before but can't now - remove it
          client.sendEncodedBytes(encodedRemoved);
        } else if (canSee && couldSeePreviously) {
          // The client could see the node before and can still see it - send a changeVisibleTo/changeHiddenFrom message with the projected ids

          if (mode === VisibleToMode) {
            const addVisibleTo = [];
            for (const connectionId of added) {
              const externalConnectionId = client.internalIdToExternalId.get(connectionId);
              if (externalConnectionId !== undefined) {
                addVisibleTo.push(externalConnectionId);
              }
            }
            const removeVisibleTo = [];
            for (const connectionId of removed) {
              const externalConnectionId = client.internalIdToExternalId.get(connectionId);
              if (externalConnectionId !== undefined) {
                removeVisibleTo.push(externalConnectionId);
              }
            }

            if (addVisibleTo.length > 0 || removeVisibleTo.length > 0) {
              client.sendMessage({
                type: "changeVisibleTo",
                nodeId: node.nodeId,
                addVisibleTo,
                removeVisibleTo,
              });
            }
          } else if (mode === HiddenFromMode) {
            const addHiddenFrom = [];
            for (const connectionId of added) {
              const externalConnectionId = client.internalIdToExternalId.get(connectionId);
              if (externalConnectionId !== undefined) {
                addHiddenFrom.push(externalConnectionId);
              }
            }
            const removeHiddenFrom = [];
            for (const connectionId of removed) {
              const externalConnectionId = client.internalIdToExternalId.get(connectionId);
              if (externalConnectionId !== undefined) {
                removeHiddenFrom.push(externalConnectionId);
              }
            }

            if (addHiddenFrom.length > 0 || removeHiddenFrom.length > 0) {
              client.sendMessage({
                type: "changeHiddenFrom",
                nodeId: node.nodeId,
                addHiddenFrom,
                removeHiddenFrom,
              });
            }
          }
        } else if (!canSee && !couldSeePreviously) {
          // The client could not see the node before and still can't - do nothing
        }
      }
    }
  }

  private reprojectStaticVirtualDOMElementWithMappings(
    staticVirtualDOMElement: StaticVirtualDOMElement,
    createIfCollided = false,
  ): StaticVirtualDOMElement {
    return {
      nodeId: this.nodeManager.getPotentiallyRemappedNode(
        staticVirtualDOMElement.nodeId,
        createIfCollided,
      ),
      tag: staticVirtualDOMElement.tag,
      attributes: staticVirtualDOMElement.attributes,
      childNodes: staticVirtualDOMElement.childNodes.map((child) =>
        this.reprojectStaticVirtualDOMElementWithMappings(child),
      ),
      textContent: staticVirtualDOMElement.textContent,
    };
  }

  private reprojectMutationWithMappings(
    mutation: StaticVirtualDOMMutationIdsRecord,
  ): StaticVirtualDOMMutationIdsRecord {
    if (!this.nodeManager.hasAnyRemappings()) {
      // There are no mappings - nothing could be changed
      return mutation;
    }

    switch (mutation.type) {
      case "attributes": {
        return {
          type: "attributes",
          targetId: this.nodeManager.getPotentiallyRemappedNode(mutation.targetId),
          attributes: mutation.attributes,
        };
      }
      case "characterData": {
        return {
          type: "characterData",
          targetId: this.nodeManager.getPotentiallyRemappedNode(mutation.targetId),
          textContent: mutation.textContent,
        };
      }
      case "childList": {
        return {
          type: "childList",
          targetId: this.nodeManager.getPotentiallyRemappedNode(mutation.targetId),
          addedNodes: mutation.addedNodes.map((node) =>
            this.reprojectStaticVirtualDOMElementWithMappings(node, true),
          ),
          removedNodeIds: mutation.removedNodeIds.map((id) =>
            this.nodeManager.getPotentiallyRemappedNode(id),
          ),
          previousSiblingId: mutation.previousSiblingId
            ? this.nodeManager.getPotentiallyRemappedNode(mutation.previousSiblingId)
            : null,
        };
      }
    }
  }

  private handleMutation(originalMutation: StaticVirtualDOMMutationIdsRecord, reproject = true) {
    const mutation = reproject
      ? this.reprojectMutationWithMappings(originalMutation)
      : originalMutation;

    if (mutation.type === "childList") {
      if (mutation.addedNodes.length === 0 && mutation.removedNodeIds.length === 0) {
        return;
      }
      if (mutation.removedNodeIds.length > 0) {
        this.handleRemovedNodes(mutation.targetId, mutation.removedNodeIds);
      }
      if (mutation.addedNodes.length > 0) {
        this.handleAddedNodes(mutation.targetId, mutation.previousSiblingId, mutation.addedNodes);
      }
    } else if (mutation.type === "attributes") {
      this.handleAttributeMutation(mutation.targetId, mutation.attributes);
    } else if (mutation.type === "characterData") {
      this.handleCharacterData(mutation.targetId, mutation.textContent);
    }
  }

  private removeNodeAndChildren(nodeId: number) {
    const node = this.nodeManager.getStaticVirtualDOMElementByInternalNodeIdOrThrow(nodeId);

    if (node.subjectivity != null) {
      for (const connectionId of node.subjectivity.visibleTo) {
        this.visibilityManager.removeSpecificallyVisibleNode(connectionId, nodeId);
      }
    }

    this.nodeManager.deleteNode(node.nodeId);

    for (const child of node.childNodes) {
      this.removeNodeAndChildren(child.nodeId);
    }
  }
}
