import {
  AttributeChangedDiff,
  ChildrenChangedDiff,
  Diff,
  ElementNodeDescription,
  NodeDescription,
  SnapshotMessage,
  TextChangedDiff,
  TextNodeDescription,
} from "@mml-io/networked-dom-protocol";
import { StaticVirtualDOMElement } from "@mml-io/observable-dom-common";

import { NodeMapping, StaticVirtualDOMMutationRecord, VirtualDOMDiffStruct } from "./common";
import * as rfc6902 from "./rfc6902";

export const visibleToAttrName = "visible-to";
export const hiddenFromAttrName = "hidden-from";

/**
 * This function does a lot of heavy lifting - it takes a mutation and applies it to the connection's view (affecting
 * which nodes are visible based on attributes etc.)
 *
 * As a result of the application it generates a diff for the particular connection's view of the DOM.
 */
export function diffFromApplicationOfStaticVirtualDOMMutationRecordToConnection(
  mutation: StaticVirtualDOMMutationRecord,
  parentNode: StaticVirtualDOMElement | null,
  connectionId: number,
  visibleNodesForConnection: Set<number>,
): Diff | null {
  const virtualDOMElement = mutation.target;

  switch (mutation.type) {
    case "snapshot": {
      const nodeDescription = describeNodeWithChildrenForConnectionId(
        virtualDOMElement,
        connectionId,
        visibleNodesForConnection,
      );
      if (!nodeDescription) {
        return null;
      }
      const diff: SnapshotMessage = {
        type: "snapshot",
        snapshot: nodeDescription,
        documentTime: 0,
      };
      return diff;
    }
    case "attributes": {
      const visible = visibleNodesForConnection.has(virtualDOMElement.nodeId);

      if (!parentNode) {
        throw new Error("Node has no parent");
      }
      const parentNodeId = parentNode.nodeId;
      const shouldBeVisible =
        shouldShowNodeToConnectionId(virtualDOMElement, connectionId) &&
        visibleNodesForConnection.has(parentNodeId);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const attributeName = mutation.attributeName!;

      if (visible && shouldBeVisible) {
        let newValue = null; // null indicates deleted
        if (virtualDOMElement.attributes[attributeName] !== undefined) {
          newValue = virtualDOMElement.attributes[attributeName];
        }
        const diff: AttributeChangedDiff = {
          type: "attributeChange",
          nodeId: virtualDOMElement.nodeId,
          attribute: attributeName,
          newValue,
        };
        return diff;
      } else if (!visible && shouldBeVisible) {
        // Need to add this child to the connection's view now
        visibleNodesForConnection.add(virtualDOMElement.nodeId);

        const index = parentNode.childNodes.indexOf(virtualDOMElement);
        if (index === -1) {
          throw new Error("Node not found in parent's children");
        }

        let previousNodeId = null;
        if (index > 0) {
          previousNodeId = getNodeIdOfPreviousVisibleSibling(
            parentNode,
            index - 1,
            visibleNodesForConnection,
          );
        }

        const nodeDescription = describeNodeWithChildrenForConnectionId(
          virtualDOMElement,
          connectionId,
          visibleNodesForConnection,
        );
        if (!nodeDescription) {
          throw new Error("Node description not found");
        }
        const diff: ChildrenChangedDiff = {
          type: "childrenChanged",
          nodeId: parentNodeId,
          previousNodeId,
          addedNodes: [nodeDescription],
          removedNodes: [],
        };
        return diff;
      } else if (visible && !shouldBeVisible) {
        removeNodeAndChildrenFromVisibleNodes(virtualDOMElement, visibleNodesForConnection);
        const diff: ChildrenChangedDiff = {
          type: "childrenChanged",
          nodeId: parentNodeId,
          previousNodeId: null,
          addedNodes: [],
          removedNodes: [virtualDOMElement.nodeId],
        };
        return diff;
      } else if (!visible && !shouldBeVisible) {
        return null;
      }
      break;
    }
    case "characterData": {
      const visible = visibleNodesForConnection.has(virtualDOMElement.nodeId);
      if (!visible) {
        return null;
      }
      const diff: TextChangedDiff = {
        type: "textChanged",
        nodeId: virtualDOMElement.nodeId,
        text: virtualDOMElement.textContent || "",
      };
      return diff;
    }
    case "childList": {
      const visible = visibleNodesForConnection.has(virtualDOMElement.nodeId);
      if (!visible) {
        return null;
      }
      let previousSibling = mutation.previousSibling;
      let previousNodeId: number | null = null;
      if (previousSibling) {
        let previousIndex = virtualDOMElement.childNodes.indexOf(previousSibling);
        while (previousIndex !== -1) {
          previousSibling = virtualDOMElement.childNodes[previousIndex];
          if (visibleNodesForConnection.has(previousSibling.nodeId)) {
            previousNodeId = previousSibling.nodeId;
            break;
          }
          previousIndex--;
        }
      }

      const diff: ChildrenChangedDiff = {
        type: "childrenChanged",
        nodeId: virtualDOMElement.nodeId,
        previousNodeId,
        addedNodes: [],
        removedNodes: [],
      };

      mutation.addedNodes.forEach((childVirtualDOMElement: StaticVirtualDOMElement) => {
        const describedNode = describeNodeWithChildrenForConnectionId(
          childVirtualDOMElement,
          connectionId,
          visibleNodesForConnection,
        );
        if (!describedNode) {
          return;
        }
        diff.addedNodes.push(describedNode);
      });
      mutation.removedNodes.forEach((childVirtualDOMElement: StaticVirtualDOMElement) => {
        if (visibleNodesForConnection.has(childVirtualDOMElement.nodeId)) {
          removeNodeAndChildrenFromVisibleNodes(childVirtualDOMElement, visibleNodesForConnection);
          diff.removedNodes.push(childVirtualDOMElement.nodeId);
        }
      });

      if (diff.addedNodes.length > 0 || diff.removedNodes.length > 0) {
        return diff;
      }
      return null;
    }
    default:
      console.error("Unknown mutation type: " + mutation.type);
      break;
  }
  return null;
}

function getNodeIdOfPreviousVisibleSibling(
  parentVirtualElement: StaticVirtualDOMElement,
  candidateIndex: number,
  visibleNodesForConnection: Set<number>,
): number | null {
  if (candidateIndex > 0) {
    let previousSiblingIndex = candidateIndex;
    while (previousSiblingIndex >= 0) {
      const previousSibling = parentVirtualElement.childNodes[previousSiblingIndex];
      if (visibleNodesForConnection.has(previousSibling.nodeId)) {
        return previousSibling.nodeId;
      }
      previousSiblingIndex--;
    }
  }
  return null;
}

function shouldShowNodeToConnectionId(
  virtualDOMElement: StaticVirtualDOMElement,
  connectionId: number,
): boolean {
  const visibleToAttr = virtualDOMElement.attributes[visibleToAttrName];
  const hiddenFromAttr = virtualDOMElement.attributes[hiddenFromAttrName];
  const connectionIdString = connectionId.toString();
  if (visibleToAttr !== undefined) {
    const visibleToList = visibleToAttr.split(" ");
    const explicityVisible = visibleToList.includes(connectionIdString);
    if (!explicityVisible) {
      return false;
    }
  }
  if (hiddenFromAttr !== undefined) {
    const hiddenFromList = hiddenFromAttr.split(" ");
    const explicityHidden = hiddenFromList.includes(connectionIdString);
    if (explicityHidden) {
      return false;
    }
  }
  return true;
}

export function describeNodeWithChildrenForConnectionId(
  virtualDOMElement: StaticVirtualDOMElement,
  connectionId: number,
  visibleNodesForConnection: Set<number>,
): NodeDescription | null {
  if (!shouldShowNodeToConnectionId(virtualDOMElement, connectionId)) {
    return null;
  }

  let emittedTagName = virtualDOMElement.tag;
  if (emittedTagName === "#document") {
    emittedTagName = "DIV";
  }
  if (emittedTagName === "#text") {
    const textNode: TextNodeDescription = {
      type: "text",
      nodeId: virtualDOMElement.nodeId,
      text: virtualDOMElement.textContent || "",
    };
    visibleNodesForConnection.add(textNode.nodeId);
    return textNode;
  } else {
    const node: ElementNodeDescription = {
      type: "element",
      nodeId: virtualDOMElement.nodeId,
      tag: emittedTagName,
      attributes: virtualDOMElement.attributes,
      children: [],
      text: virtualDOMElement.textContent,
    };
    visibleNodesForConnection.add(node.nodeId);

    for (const child of virtualDOMElement.childNodes) {
      const childNodeDescription = describeNodeWithChildrenForConnectionId(
        child,
        connectionId,
        visibleNodesForConnection,
      );
      if (childNodeDescription) {
        node.children.push(childNodeDescription);
      }
    }
    return node;
  }
}

function removeNodeAndChildrenFromVisibleNodes(
  virtualDOMElement: StaticVirtualDOMElement,
  visibleNodesForConnection: Set<number>,
): void {
  visibleNodesForConnection.delete(virtualDOMElement.nodeId);
  for (const child of virtualDOMElement.childNodes) {
    if (!visibleNodesForConnection.has(child.nodeId)) {
      console.error("Inner child of removed element was not visible", child.nodeId);
    }
    removeNodeAndChildrenFromVisibleNodes(child, visibleNodesForConnection);
  }
}

export function findParentNodeOfNodeId(
  virtualDOMElement: StaticVirtualDOMElement,
  targetNodeId: number,
): StaticVirtualDOMElement | null {
  // TODO - avoid a search of the whole tree for the node's parent
  // depth-first search of the whole virtual dom structure to find the node's parent
  for (const child of virtualDOMElement.childNodes) {
    if (child.nodeId === targetNodeId) {
      return virtualDOMElement;
    } else {
      const foundParentId = findParentNodeOfNodeId(child, targetNodeId);
      if (foundParentId) {
        return foundParentId;
      }
    }
  }
  return null;
}

export function virtualDOMDiffToVirtualDOMMutationRecord(
  virtualStructure: StaticVirtualDOMElement,
  domDiff: rfc6902.Operation,
): Array<StaticVirtualDOMMutationRecord> {
  const pointer = rfc6902.Pointer.fromJSON(domDiff.path);
  const grandParentTokens = pointer.tokens.slice(0, pointer.tokens.length - 2);
  const lastToken = pointer.tokens[pointer.tokens.length - 1];
  const secondLastToken = pointer.tokens[pointer.tokens.length - 2];

  if (lastToken === "textContent") {
    const nodePointer = new rfc6902.Pointer(pointer.tokens.slice(0, pointer.tokens.length - 1));
    const node = nodePointer.get(virtualStructure) as StaticVirtualDOMElement;
    return [
      {
        type: "characterData",
        target: node,
        addedNodes: [],
        removedNodes: [],
        attributeName: null,
        previousSibling: null,
      },
    ];
  }

  if (secondLastToken === "attributes") {
    // This handles attribute additions, changes, and removals
    const nodePointer = new rfc6902.Pointer(grandParentTokens);
    const node = nodePointer.get(virtualStructure) as StaticVirtualDOMElement;
    return [
      {
        type: "attributes",
        target: node,
        addedNodes: [],
        removedNodes: [],
        attributeName: lastToken,
        previousSibling: null,
      },
    ];
  }

  // Child changes

  if (secondLastToken === "childNodes") {
    const nodePointer = new rfc6902.Pointer(grandParentTokens);
    const node = nodePointer.get(virtualStructure) as StaticVirtualDOMElement;

    let previousSibling: StaticVirtualDOMElement | null = null;
    if (lastToken === "-") {
      // Append to the end of the children
    } else {
      const index = parseInt(lastToken, 10);
      if (index === 0) {
        previousSibling = null;
      } else {
        previousSibling = node.childNodes[index - 1];
      }
    }
    const addedNodes: Array<StaticVirtualDOMElement> = [];
    const removedNodes: Array<StaticVirtualDOMElement> = [];
    switch (domDiff.op) {
      case "add": {
        addedNodes.push(domDiff.value);
        return [
          {
            type: "childList",
            target: node,
            addedNodes,
            removedNodes,
            previousSibling,
            attributeName: null,
          },
        ];
      }
      case "remove": {
        const removedNode = pointer.get(virtualStructure) as StaticVirtualDOMElement;
        removedNodes.push(removedNode);
        return [
          {
            type: "childList",
            target: node,
            addedNodes,
            removedNodes,
            previousSibling,
            attributeName: null,
          },
        ];
      }
      case "replace": {
        // This is a replacement of a single node
        const removedNode = pointer.get(virtualStructure) as StaticVirtualDOMElement;
        removedNodes.push(removedNode);
        addedNodes.push(domDiff.value);
        return [
          {
            type: "childList",
            target: node,
            addedNodes: [],
            removedNodes,
            previousSibling,
            attributeName: null,
          },
          {
            type: "childList",
            target: node,
            addedNodes,
            removedNodes: [],
            previousSibling,
            attributeName: null,
          },
        ];
      }
    }
  }

  if (domDiff.op === "replace" && domDiff.path === "") {
    const node = domDiff.value as StaticVirtualDOMElement;
    return [
      {
        type: "snapshot",
        target: node,
        addedNodes: [],
        removedNodes: [],
        previousSibling: null,
        attributeName: null,
      },
    ];
  }

  console.error("Unhandled JSON diff:", JSON.stringify(domDiff, null, 2));
  throw new Error("Unhandled diff type");
}

export function calculateStaticVirtualDOMDiff(
  originalState: StaticVirtualDOMElement,
  latestState: StaticVirtualDOMElement,
): VirtualDOMDiffStruct {
  const jsonPatchDiffs = rfc6902.createPatch(
    originalState,
    latestState,
    (a, b, ptr: rfc6902.Pointer) => {
      if (a.tag !== b.tag) {
        return [{ op: "replace", path: ptr.toString(), value: b }];
      }
      return;
    },
  );

  const nodeIdRemappings: Array<NodeMapping> = [];
  const virtualDOMDiffs: Array<rfc6902.Operation> = [];
  for (const diff of jsonPatchDiffs) {
    if (diff.op === "replace" && diff.path.endsWith("/nodeId")) {
      const pointer = rfc6902.Pointer.fromJSON(diff.path);
      const originalValue = pointer.get(originalState);
      nodeIdRemappings.push({
        internalNodeId: diff.value,
        clientFacingNodeId: originalValue,
      });
    } else {
      virtualDOMDiffs.push(diff);
    }
  }

  return remapDuplicatedNodeIdsInOperations(
    {
      originalState,
      nodeIdRemappings,
      virtualDOMDiffs,
    },
    latestState,
  );
}

function getHighestNodeId(node: StaticVirtualDOMElement) {
  let highest = node.nodeId;
  for (const child of node.childNodes) {
    highest = Math.max(highest, getHighestNodeId(child));
  }
  return highest;
}

function getRemovedNodeIds(before: StaticVirtualDOMElement, diff: rfc6902.Operation) {
  const removedIds = new Set<number>();
  function addNode(node: StaticVirtualDOMElement) {
    removedIds.add(node.nodeId);
    for (const child of node.childNodes) {
      addNode(child);
    }
  }
  if (diff.op === "replace" || diff.op === "remove") {
    const removedNode = rfc6902.Pointer.fromJSON(diff.path).get(before);
    addNode(removedNode);
  }
  return removedIds;
}

function getNodeIdsFromNodeAndChildren(node: StaticVirtualDOMElement) {
  const nodeIds = new Set<number>();
  function addNode(node: StaticVirtualDOMElement) {
    nodeIds.add(node.nodeId);
    for (const child of node.childNodes) {
      addNode(child);
    }
  }
  addNode(node);
  return nodeIds;
}

// To avoid duplicate node ids at any point in the sequence of operations, apply the operations and determine if any node ids are duplicated at any point. If so, remap the node ids to be unique.
function remapDuplicatedNodeIdsInOperations(
  virtualDOMDiffStruct: VirtualDOMDiffStruct,
  latestState: StaticVirtualDOMElement,
): VirtualDOMDiffStruct {
  const { originalState, nodeIdRemappings, virtualDOMDiffs } = virtualDOMDiffStruct;

  const highestNodeIdAcrossStartAndEnd = Math.max(
    getHighestNodeId(originalState),
    getHighestNodeId(latestState),
  );
  let nextNodeId = highestNodeIdAcrossStartAndEnd + 1;

  const before = JSON.parse(JSON.stringify(originalState));

  function checkAndReplaceNodeIdsIfAlreadyInUse(
    node: StaticVirtualDOMElement,
    addingNodeIds: Set<number>,
    removedIds: Set<number>,
  ) {
    if (existingNodeIds.has(node.nodeId) && removedIds && !removedIds.has(node.nodeId)) {
      // This node id is already present so it must be replaced
      const newNodeId = nextNodeId++;
      nodeIdRemappings.push({
        internalNodeId: node.nodeId,
        clientFacingNodeId: newNodeId,
      });
      node.nodeId = newNodeId;
      addingNodeIds.add(newNodeId);
    } else {
      addingNodeIds.add(node.nodeId);
    }
    for (const child of node.childNodes) {
      checkAndReplaceNodeIdsIfAlreadyInUse(child, addingNodeIds, removedIds);
    }
  }

  const existingNodeIds = getNodeIdsFromNodeAndChildren(before);

  for (const diff of virtualDOMDiffs) {
    const pointer = rfc6902.Pointer.fromJSON(diff.path);
    const secondLastToken = pointer.tokens[pointer.tokens.length - 2];
    if (secondLastToken !== "childNodes") {
      continue;
    }
    const removedIds = getRemovedNodeIds(before, diff);
    const addingNodeIds = new Set<number>();
    if (diff.op === "replace" || diff.op === "add") {
      // The added node can use removed node ids, but it must not use any node ids that are still in use.
      checkAndReplaceNodeIdsIfAlreadyInUse(diff.value, addingNodeIds, removedIds);
    }
    removedIds.forEach((removedId) => {
      existingNodeIds.delete(removedId);
    });
    addingNodeIds.forEach((addingNodeId) => {
      existingNodeIds.add(addingNodeId);
    });

    const patchErrors = rfc6902.applyPatch(before, [diff]);
    if (patchErrors.length !== 1 || patchErrors[0] !== null) {
      throw new Error("Patch failed");
    }
  }

  return virtualDOMDiffStruct;
}
