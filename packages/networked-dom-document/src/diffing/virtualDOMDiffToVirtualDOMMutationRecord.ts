import {
  StaticVirtualDOMElement,
  StaticVirtualDOMMutationIdsRecord,
} from "@mml-io/observable-dom-common";

import * as rfc6902 from "../rfc6902";

export function virtualDOMDiffToVirtualDOMMutationRecord(
  virtualStructure: StaticVirtualDOMElement,
  domDiff: rfc6902.Operation,
): Array<StaticVirtualDOMMutationIdsRecord> {
  const pointer = rfc6902.Pointer.fromJSON(domDiff.path);
  const grandParentTokens = pointer.tokens.slice(0, pointer.tokens.length - 2);
  const lastToken = pointer.tokens[pointer.tokens.length - 1];
  const secondLastToken = pointer.tokens[pointer.tokens.length - 2];

  if (lastToken === "textContent") {
    const nodePointer = new rfc6902.Pointer(pointer.tokens.slice(0, pointer.tokens.length - 1));
    const node = nodePointer.get(virtualStructure) as StaticVirtualDOMElement;
    if (domDiff.op === "replace" || domDiff.op === "add") {
      return [
        {
          type: "characterData",
          targetId: node.nodeId,
          textContent: domDiff.value as string,
        },
      ];
    } else {
      throw new Error("Unhandled character data diff type");
    }
  }

  if (secondLastToken === "attributes") {
    // This handles attribute additions, changes, and removals
    const nodePointer = new rfc6902.Pointer(grandParentTokens);
    const node = nodePointer.get(virtualStructure) as StaticVirtualDOMElement;
    let value;
    if (domDiff.op === "remove") {
      value = null;
    } else if (domDiff.op === "replace" || domDiff.op === "add") {
      value = domDiff.value;
    } else {
      throw new Error("Unhandled attribute diff type");
    }
    return [
      {
        type: "attributes",
        targetId: node.nodeId,
        attributes: {
          [lastToken]: value,
        },
      },
    ];
  }

  // Child changes

  if (secondLastToken === "childNodes") {
    const nodePointer = new rfc6902.Pointer(grandParentTokens);
    const node = nodePointer.get(virtualStructure) as StaticVirtualDOMElement;

    let previousSibling: StaticVirtualDOMElement | null = null;
    if (lastToken === "-") {
      if (node.childNodes.length > 0) {
        previousSibling = node.childNodes[node.childNodes.length - 1];
      } else {
        // There are no siblings to account for
      }
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
        addedNodes.push(domDiff.value as StaticVirtualDOMElement);
        return [
          {
            type: "childList",
            targetId: node.nodeId,
            addedNodes,
            removedNodeIds: [],
            previousSiblingId: previousSibling ? previousSibling.nodeId : null,
          },
        ];
      }
      case "remove": {
        const removedNode = pointer.get(virtualStructure) as StaticVirtualDOMElement;
        removedNodes.push(removedNode);
        return [
          {
            type: "childList",
            targetId: node.nodeId,
            addedNodes,
            removedNodeIds: removedNodes.map((node) => node.nodeId),
            previousSiblingId: previousSibling ? previousSibling.nodeId : null,
          },
        ];
      }
      case "replace": {
        // This is a replacement of a single node
        const removedNode = pointer.get(virtualStructure) as StaticVirtualDOMElement;
        return [
          {
            type: "childList",
            targetId: node.nodeId,
            addedNodes: [],
            removedNodeIds: [removedNode.nodeId],
            previousSiblingId: previousSibling ? previousSibling.nodeId : null,
          },
          {
            type: "childList",
            targetId: node.nodeId,
            addedNodes: [domDiff.value as StaticVirtualDOMElement],
            removedNodeIds: [],
            previousSiblingId: previousSibling ? previousSibling.nodeId : null,
          },
        ];
      }
    }
  }

  if (domDiff.op === "replace" && domDiff.path === "") {
    throw new Error("Not implemented - root node is not replaceable");
  }

  console.error("Unhandled JSON diff:", JSON.stringify(domDiff, null, 2));
  throw new Error("Unhandled diff type");
}
