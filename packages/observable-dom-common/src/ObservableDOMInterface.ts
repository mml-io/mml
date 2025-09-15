export type ObservableDOMRemoteEvent = {
  nodeId: number;
  name: string;
  bubbles: boolean;
  params: any;
};

export type StaticVirtualDOMElement = {
  nodeId: number;
  tag: string;
  textContent?: string;
  attributes: { [key: string]: string };
  childNodes: Array<StaticVirtualDOMElement>;
};

export type StaticVirtualDOMMutationIdsRecord =
  | {
      type: "attributes";
      targetId: number;
      attributes: { [key: string]: string | null };
    }
  | {
      type: "characterData";
      targetId: number;
      textContent: string;
    }
  | {
      type: "childList";
      targetId: number;
      addedNodes: Array<StaticVirtualDOMElement>;
      removedNodeIds: Array<number>;
      previousSiblingId: number | null;
    };

export type ObservableDOMInterface = {
  addConnectedUserId(connectionId: number, connectionToken: string | null): void;
  removeConnectedUserId(connectionId: number): void;
  dispatchRemoteEventFromConnectionId(
    connectionId: number,
    remoteEvent: ObservableDOMRemoteEvent,
  ): void;
  dispose(): void;
};

export type LogMessage = {
  level: "system" | "error" | "warn" | "log" | "info";
  content: any[];
};

export type ObservableDOMMessage = {
  snapshot?: StaticVirtualDOMElement;
  mutations?: Array<StaticVirtualDOMMutationIdsRecord>;
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
