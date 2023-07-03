import { RemoteEvent } from "@mml-io/networked-dom-protocol";

export type StaticVirtualDOMElement = {
  nodeId: number;
  tag: string;
  textContent?: string;
  attributes: { [key: string]: string };
  childNodes: Array<StaticVirtualDOMElement>;
};

export type StaticVirtualDOMMutationIdsRecord = {
  type: "attributes" | "characterData" | "childList";
  targetId: number;
  addedNodes: Array<StaticVirtualDOMElement>;
  removedNodeIds: Array<number>;
  previousSiblingId: number | null;
  attribute: { attributeName: string; value: string | null } | null;
};

export type ObservableDOMInterface = {
  addConnectedUserId(connectionId: number): void;
  removeConnectedUserId(connectionId: number): void;
  dispatchRemoteEventFromConnectionId(connectionId: number, remoteEvent: RemoteEvent): void;
  dispose(): void;
};

export type LogMessage = {
  level: "system" | "error" | "warn" | "log" | "info";
  content: any[];
};

export type ObservableDOMMessage = {
  snapshot?: StaticVirtualDOMElement;
  mutation?: StaticVirtualDOMMutationIdsRecord;
  logMessage?: LogMessage;
  documentTime: number;
};

export type ObservableDOMParameters = {
  htmlPath: string;
  htmlContents: string;
  params: object;
  ignoreTextNodes: boolean;
  pingIntervalMilliseconds?: number;
};
