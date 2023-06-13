import { StaticVirtualDomElement } from "@mml-io/observable-dom-common";
import * as rfc6902 from "rfc6902";

export type NodeMapping = {
  clientFacingNodeId: number;
  internalNodeId: number;
};

export type VirtualDOMDiffStruct = {
  originalState: StaticVirtualDomElement;
  nodeIdRemappings: Array<NodeMapping>;
  virtualDOMDiffs: Array<rfc6902.Operation>;
};

// This is similar to the MutationRecord type in the DOM spec, but it references StaticVirtualDomElements instead of DOM nodes.
export type StaticVirtualDomMutationRecord = {
  type: "attributes" | "characterData" | "childList";
  target: StaticVirtualDomElement;
  addedNodes: Array<StaticVirtualDomElement>;
  removedNodes: Array<StaticVirtualDomElement>;
  previousSibling: StaticVirtualDomElement | null;
  attributeName: string | null;
};
