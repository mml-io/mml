import { StaticVirtualDOMElement } from "@mml-io/observable-dom-common";
import * as rfc6902 from "rfc6902";

export type NodeMapping = {
  clientFacingNodeId: number;
  internalNodeId: number;
};

export type VirtualDOMDiffStruct = {
  originalState: StaticVirtualDOMElement;
  nodeIdRemappings: Array<NodeMapping>;
  virtualDOMDiffs: Array<rfc6902.Operation>;
};

// This is similar to the MutationRecord type in the DOM spec, but it references StaticVirtualDOMElements instead of DOM nodes.
export type StaticVirtualDOMMutationRecord = {
  type: "attributes" | "characterData" | "childList" | "snapshot";
  target: StaticVirtualDOMElement;
  addedNodes: Array<StaticVirtualDOMElement>;
  removedNodes: Array<StaticVirtualDOMElement>;
  previousSibling: StaticVirtualDOMElement | null;
  attributeName: string | null;
};
