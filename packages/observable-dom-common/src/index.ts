import { RemoteEvent } from "@mml-io/networked-dom-protocol";

export type { RemoteEvent } from "@mml-io/networked-dom-protocol";

export type StaticVirtualDomElement = {
  nodeId: number;
  tag: string;
  textContent?: string;
  attributes: { [key: string]: string };
  childNodes: Array<StaticVirtualDomElement>;
};

export type StaticVirtualDomMutationIdsRecord = {
  type: "attributes" | "characterData" | "childList";
  targetId: number;
  addedNodes: Array<StaticVirtualDomElement>;
  removedNodeIds: Array<number>;
  previousSiblingId: number | null;
  attribute: { attributeName: string; value: string | null } | null;
};

export type ObservableDomInterface = {
  addConnectedUserId(connectionId: number): void;
  removeConnectedUserId(connectionId: number): void;
  dispose(): void;
  dispatchRemoteEventFromConnectionId(connectionId: number, remoteEvent: RemoteEvent): void;
  addIPCWebsocket(webSocket: WebSocket): void;
};






export type ObservableDomMessage = {
  snapshot?: StaticVirtualDomElement;
  mutation?: StaticVirtualDomMutationIdsRecord;

  documentTime: number;
};

export type ObservableDOMParameters = {
  htmlPath: string;
  htmlContents: string;
  params: object;
  ignoreTextNodes: boolean;
  pingIntervalMilliseconds?: number;
};
