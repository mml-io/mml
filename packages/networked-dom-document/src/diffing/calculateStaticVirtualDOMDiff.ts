import { StaticVirtualDOMElement } from "@mml-io/observable-dom-common";

import * as rfc6902 from "../rfc6902";

export type NodeMapping = {
  clientFacingNodeId: number;
  internalNodeId: number;
};

/**
 * VirtualDOMDiffStruct is a representation of how a VirtualDOM has changed. It contains the original state of the
 * VirtualDOM, a list of node ID remappings, and a list of RFC6902 operations that can be applied to the original state
 * to produce the new state.
 */
export type VirtualDOMDiffStruct = {
  originalState: StaticVirtualDOMElement;
  nodeIdRemappings: Array<NodeMapping>;
  virtualDOMDiffs: Array<rfc6902.Operation>;
};

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
