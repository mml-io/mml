import { StaticVirtualDOMElement } from "@mml-io/observable-dom-common";

import * as rfc6902 from "./rfc6902";

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

/**
 * StaticVirtualDOMMutationRecord is a plain object representation of a MutationRecord that can be serialized as it
 * contains no references to DOM elements and instead uses node IDs to refer to elements.
 */
export type StaticVirtualDOMMutationRecord = {
  type: "attributes" | "characterData" | "childList" | "snapshot";
  target: StaticVirtualDOMElement;
  addedNodes: Array<StaticVirtualDOMElement>;
  removedNodes: Array<StaticVirtualDOMElement>;
  previousSibling: StaticVirtualDOMElement | null;
  attributeName: string | null;
};
