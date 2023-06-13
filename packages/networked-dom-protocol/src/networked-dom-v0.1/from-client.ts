export type RemoteEvent = {
  type: "event";
  nodeId: number;
  name: string;
  bubbles: boolean;
  params: any;
};

export type PongMessage = {
  type: "pong";
  pong: number;
};

export type ClientMessage = RemoteEvent | PongMessage;
