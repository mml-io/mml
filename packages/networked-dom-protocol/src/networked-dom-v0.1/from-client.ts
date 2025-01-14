export type NetworkedDOMV01RemoteEvent = {
  type: "event";
  nodeId: number;
  name: string;
  bubbles: boolean;
  params: any;
};

export type NetworkedDOMV01PongMessage = {
  type: "pong";
  pong: number;
};

export type NetworkedDOMV01ClientMessage = NetworkedDOMV01RemoteEvent | NetworkedDOMV01PongMessage;
