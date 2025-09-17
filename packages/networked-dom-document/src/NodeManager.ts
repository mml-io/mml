import { StaticVirtualDOMElement } from "@mml-io/observable-dom-common";

import { hiddenFromAttrName, visibleToAttrName } from "./diffing/describeNode";
import { listAttributeToSet } from "./diffing/listAttributeToSet";
import { NodeWithSubjectivity, Subjectivity } from "./NodeWithSubjectivity";
import { VisibilityManager } from "./VisibilityManager";

export class NodeManager {
  private nodeIdToNode = new Map<number, NodeWithSubjectivity>();
  private maximumNodeId = 0;

  // Map from the node ids that the DOM uses internally to the node ids that clients refer to.
  private internalNodeIdToClientNodeId = new Map<number, number>();

  // Map from the node ids that clients refer to to the node ids that the DOM uses internally.
  private clientNodeIdToInternalNodeId = new Map<number, number>();

  constructor(private visibilityManager: VisibilityManager) {}

  public getNode(nodeId: number): NodeWithSubjectivity | undefined {
    return this.nodeIdToNode.get(nodeId);
  }

  public deleteNode(nodeId: number) {
    this.nodeIdToNode.delete(nodeId);
  }

  public addNodeFromInstance(
    node: StaticVirtualDOMElement,
    parentNode: NodeWithSubjectivity | null,
  ): [NodeWithSubjectivity, boolean] {
    let hasSubjectivity = false;
    const nodeId = node.nodeId;
    if (this.nodeIdToNode.has(nodeId)) {
      throw new Error("Node already exists with id " + nodeId);
    }

    const parentSubjectivity = parentNode
      ? parentNode.subjectivity
      : {
          // Root node case
          visibleTo: new Set<number>(),
          hiddenFrom: new Set<number>(),
          ancestorSubjectivity: null,
        };
    const visibleTo = listAttributeToSet(node.attributes[visibleToAttrName]);
    const hiddenFrom = listAttributeToSet(node.attributes[hiddenFromAttrName]);
    let subjectivity: Subjectivity = parentSubjectivity;
    if (visibleTo.size > 0 || hiddenFrom.size > 0) {
      hasSubjectivity = true;
      subjectivity = {
        visibleTo,
        hiddenFrom,
        ancestorSubjectivity: parentSubjectivity,
      };
      for (const connectionId of visibleTo) {
        this.visibilityManager.addSpecificallyVisibleNode(connectionId, nodeId);
      }
    }

    const attributes = { ...node.attributes };
    if (attributes[visibleToAttrName]) {
      delete attributes[visibleToAttrName];
    }
    if (attributes[hiddenFromAttrName]) {
      delete attributes[hiddenFromAttrName];
    }

    const nodeWithSubjectivity: NodeWithSubjectivity = {
      nodeId,
      tag: node.tag,
      textContent: node.textContent,
      attributes,
      childNodes: [],
      subjectivity,
      parent: parentNode,
    };

    this.nodeIdToNode.set(nodeId, nodeWithSubjectivity);
    this.maximumNodeId = Math.max(this.maximumNodeId, nodeId);

    for (const childNode of node.childNodes) {
      const [addedChild, childSubjectivity] = this.addNodeFromInstance(
        childNode,
        nodeWithSubjectivity,
      );
      if (childSubjectivity) {
        hasSubjectivity = true;
      }
      nodeWithSubjectivity.childNodes.push(addedChild);
    }

    return [nodeWithSubjectivity, hasSubjectivity];
  }

  public addRemappedNodeId(clientFacingNodeId: number, internalNodeId: number) {
    if (this.internalNodeIdToClientNodeId.has(internalNodeId)) {
      throw new Error("Node already exists with internal node id " + internalNodeId);
    }
    if (this.clientNodeIdToInternalNodeId.has(clientFacingNodeId)) {
      throw new Error("Node already exists with client id " + clientFacingNodeId);
    }
    this.internalNodeIdToClientNodeId.set(internalNodeId, clientFacingNodeId);
    this.clientNodeIdToInternalNodeId.set(clientFacingNodeId, internalNodeId);
    this.maximumNodeId = Math.max(this.maximumNodeId, Math.max(clientFacingNodeId, internalNodeId));
  }

  public hasAnyRemappings(): boolean {
    return this.internalNodeIdToClientNodeId.size > 0;
  }

  public getPotentiallyRemappedNode(nodeId: number, createIfCollided = false): number {
    const newId = this.internalNodeIdToClientNodeId.get(nodeId);
    if (newId !== undefined) {
      return newId;
    }
    if (createIfCollided) {
      // If a node already exists with this id, we need to create a new id and return that instead, otherwise we can use the id
      if (this.nodeIdToNode.has(nodeId) || this.clientNodeIdToInternalNodeId.has(nodeId)) {
        // Collision - need to create a new id
        const newId2 = ++this.maximumNodeId;
        this.addRemappedNodeId(newId2, nodeId);
        return newId2;
      }
      return nodeId;
    }
    return nodeId;
  }

  public getStaticVirtualDOMElementByInternalNodeIdOrThrow(
    internalNodeId: number,
  ): NodeWithSubjectivity {
    const node = this.nodeIdToNode.get(internalNodeId);
    if (!node) {
      throw new Error("Node not found with nodeId:" + internalNodeId);
    }
    return node;
  }

  public getInternalRemappedNodeId(nodeId: number): number | undefined {
    return this.clientNodeIdToInternalNodeId.get(nodeId);
  }
}
