export type NetworkedDOMV01ElementNodeDescription = {
  type: "element";
  nodeId: number;
  tag: string;
  attributes: { [key: string]: string };
  children: Array<NetworkedDOMV01NodeDescription>;
  text?: string;
};

export type NetworkedDOMV01TextNodeDescription = {
  type: "text";
  nodeId: number;
  text: string;
};

export type NetworkedDOMV01NodeDescription =
  | NetworkedDOMV01ElementNodeDescription
  | NetworkedDOMV01TextNodeDescription;

export type NetworkedDOMV01SnapshotMessage = {
  type: "snapshot";
  snapshot: NetworkedDOMV01NodeDescription;
  documentTime: number;
};

export type NetworkedDOMV01ChildrenChangedDiff = {
  type: "childrenChanged";
  nodeId: number;
  previousNodeId: number | null;
  addedNodes: Array<NetworkedDOMV01NodeDescription>;
  removedNodes: Array<number>;
  documentTime?: number;
};

export type NetworkedDOMV01TextChangedDiff = {
  type: "textChanged";
  nodeId: number;
  text: string;
  documentTime?: number;
};

export type NetworkedDOMV01AttributeChangedDiff = {
  type: "attributeChange";
  nodeId: number;
  attribute: string;
  newValue: string | null;
  documentTime?: number;
};

export type NetworkedDOMV01Diff =
  | NetworkedDOMV01SnapshotMessage
  | NetworkedDOMV01ChildrenChangedDiff
  | NetworkedDOMV01AttributeChangedDiff
  | NetworkedDOMV01TextChangedDiff;

export type NetworkedDOMV01PingMessage = {
  type: "ping";
  ping: number;
  documentTime: number;
};

export type NetworkedDOMV01ErrorMessage = {
  type: "error";
  message: string;
};

export type NetworkedDOMV01WarningMessage = {
  type: "warning";
  message: string;
};

export type NetworkedDOMV01ServerMessage =
  | NetworkedDOMV01Diff
  | NetworkedDOMV01PingMessage
  | NetworkedDOMV01ErrorMessage
  | NetworkedDOMV01WarningMessage;
