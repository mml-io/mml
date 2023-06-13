export type ElementNodeDescription = {
  type: "element";
  nodeId: number;
  tag: string;
  attributes: { [key: string]: string };
  children: Array<NodeDescription>;
  text?: string;
};

export type TextNodeDescription = {
  type: "text";
  nodeId: number;
  text: string;
};

export type NodeDescription = ElementNodeDescription | TextNodeDescription;

export type SnapshotMessage = {
  type: "snapshot";
  snapshot: NodeDescription;
  documentTime: number;
};

export type ChildrenChangedDiff = {
  type: "childrenChanged";
  nodeId: number;
  previousNodeId: number | null;
  addedNodes: Array<NodeDescription>;
  removedNodes: Array<number>;
  documentTime?: number;
};

export type TextChangedDiff = {
  type: "textChanged";
  nodeId: number;
  text: string;
  documentTime?: number;
};

export type AttributeChangedDiff = {
  type: "attributeChange";
  nodeId: number;
  attribute: string;
  newValue: string | null;
  documentTime?: number;
};

export type Diff = ChildrenChangedDiff | AttributeChangedDiff | TextChangedDiff;

export type PingMessage = {
  type: "ping";
  ping: number;
  documentTime: number;
};

export type ErrorMessage = {
  type: "error";
  message: string;
};

export type WarningMessage = {
  type: "warning";
  message: string;
};

export type ServerMessage = SnapshotMessage | Diff | PingMessage | ErrorMessage | WarningMessage;
