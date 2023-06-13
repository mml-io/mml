import {
  LogMessage,
  ObservableDomInterface,
  ObservableDomMessage,
  ObservableDOMParameters,
  RemoteEvent,
  StaticVirtualDomElement,
  StaticVirtualDomMutationIdsRecord,
} from "@mml-io/observable-dom-common";

import { virtualDomElementToStatic } from "./utils";

export type DOMRunnerMessage = {
  loaded?: boolean;
  mutationList?: Array<MutationRecord>;
  logMessage?: LogMessage;
};

export type DOMRunnerInterface = {
  getDocument(): Document;
  getWindow(): Window & {
    CustomEvent: typeof CustomEvent;
    Text: typeof Text;
    HTMLScriptElement: typeof HTMLScriptElement;
    Comment: typeof Comment;
  }; // TODO - Define this without using JSDOM types
  addIPCWebsocket(webSocket: WebSocket): void;
  dispatchRemoteEventFromConnectionId(
    connectionId: number,
    realElement: Element,
    remoteEvent: RemoteEvent,
  ): void;
  dispose(): void;
  getDocumentTime(): number;
};

export type DOMRunnerFactory = (
  htmlPath: string,
  htmlContents: string,
  params: object,
  callback: (domRunnerMessage: DOMRunnerMessage) => void,
) => DOMRunnerInterface;

export type LiveVirtualDomElement = Omit<StaticVirtualDomElement, "childNodes"> & {
  realElement: Element | Text;
  childNodes: Array<LiveVirtualDomElement>;
  parent: LiveVirtualDomElement | null;
};

export class ObservableDom implements ObservableDomInterface {
  private nodeToNodeId = new Map<LiveVirtualDomElement, number>();
  private nodeIdToNode = new Map<number, LiveVirtualDomElement>();
  private realElementToVirtualElement = new Map<Element | Text, LiveVirtualDomElement>();
  private ignoreTextNodes = true;
  private callback: (message: ObservableDomMessage) => void;
  private nextNodeId = 1;
  private htmlPath: string;
  private domRunner: DOMRunnerInterface;

  private documentTimeIntervalTimer: NodeJS.Timer;

  constructor(
    observableDOMParameters: ObservableDOMParameters,
    callback: (message: ObservableDomMessage) => void,
    runnerFactory: DOMRunnerFactory,
  ) {
    this.htmlPath = observableDOMParameters.htmlPath;
    this.ignoreTextNodes = observableDOMParameters.ignoreTextNodes;
    this.callback = callback;

    this.documentTimeIntervalTimer = setInterval(() => {
      this.callback({
        documentTime: this.getDocumentTime(),
      });
    }, observableDOMParameters.pingIntervalMilliseconds || 5000);

    this.domRunner = runnerFactory(
      observableDOMParameters.htmlPath,
      observableDOMParameters.htmlContents,
      observableDOMParameters.params,
      (domRunnerMessage: DOMRunnerMessage) => {
        if (domRunnerMessage.loaded) {
          this.createVirtualDomElementWithChildren(
            this.domRunner.getDocument() as unknown as Element,
            null,
          );

          const snapshot = virtualDomElementToStatic(
            this.getVirtualDomElementForRealElementOrThrow(
              this.domRunner.getDocument() as unknown as Element,
            ),
          );

          this.callback({
            snapshot,
            documentTime: this.getDocumentTime(),
          });
        } else if (domRunnerMessage.mutationList) {
          this.processModificationList(domRunnerMessage.mutationList);
        } else if (domRunnerMessage.logMessage) {
          this.callback({
            logMessage: domRunnerMessage.logMessage,
            documentTime: this.getDocumentTime(),
          });
        }
      },
    );
  }

  public addIPCWebsocket(webSocket: WebSocket) {
    return this.domRunner.addIPCWebsocket(webSocket);
  }

  public addConnectedUserId(connectionId: number): void {
    this.domRunner.getWindow().dispatchEvent(
      new (this.domRunner.getWindow().CustomEvent)("connected", {
        detail: { connectionId },
      }),
    );
  }

  public removeConnectedUserId(connectionId: number): void {
    this.domRunner.getWindow().dispatchEvent(
      new (this.domRunner.getWindow().CustomEvent)("disconnected", {
        detail: { connectionId },
      }),
    );
  }

  private processModificationList(mutationList: Array<MutationRecord>): void {
    const documentEl = this.domRunner.getDocument() as unknown as Element;
    const documentVirtualDomElement = this.realElementToVirtualElement.get(documentEl);
    if (!documentVirtualDomElement) {
      throw new Error(`document not created in processModificationList`);
    }

    if (mutationList.length > 1) {
      // TODO - walk back through the records to derive the intermediate states (e.g. if an attribute is later added to
      //  an element created in an earlier record then it should not have that attribute when the element is added.
      //  This is important as incorrect attribute sets can affect visibility and expected client performance.
      console.error(
        "More than one mutation record received. It is possible that intermediate states are incorrect.",
      );
    }

    for (const mutation of mutationList) {
      if (this.isIgnoredElement(mutation.target as Element | Text)) {
        continue;
      }

      if (
        mutation.type === "attributes" &&
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.isIgnoredAttribute(mutation.target as Element | Text, mutation.attributeName!)
      ) {
        continue;
      }

      this.addKnownNodesInMutation(mutation);

      // Convert the "real" DOM MutationRecord into a "virtual" DOM MutationRecord that references the VirtualDOMElements
      // This is done so that the same process for handling mutations can be used for both changes to a live DOM and also
      // to diffs between DOM snapshots when reloading
      const firstNonIgnoredPreviousSibling = mutation.previousSibling
        ? this.getFirstNonIgnoredPreviousSibling(mutation.previousSibling as Element | Text)
        : null;
      const targetElement = this.getVirtualDomElementForRealElementOrThrow(
        mutation.target as Element | Text,
      );
      const addedNodes: Array<StaticVirtualDomElement> = [];
      for (const node of mutation.addedNodes) {
        if (this.isIgnoredElement(node as Element | Text)) {
          continue;
        }
        const virtualDomElement = this.getVirtualDomElementForRealElementOrThrow(
          node as Element | Text,
        );
        addedNodes.push(virtualDomElementToStatic(virtualDomElement));
      }

      const removedNodeIds: Array<number> = [];
      for (const node of mutation.removedNodes) {
        if (this.isIgnoredElement(node as Element | Text)) {
          continue;
        }
        const virtualDomElement = this.getVirtualDomElementForRealElementOrThrow(
          node as Element | Text,
        );
        removedNodeIds.push(virtualDomElement.nodeId);
      }

      const mutationRecord: StaticVirtualDomMutationIdsRecord = {
        type: mutation.type,
        targetId: targetElement.nodeId,
        addedNodes,
        removedNodeIds,
        previousSiblingId:
          firstNonIgnoredPreviousSibling !== null
            ? this.getVirtualDomElementForRealElementOrThrow(firstNonIgnoredPreviousSibling).nodeId
            : null,
        attribute: mutation.attributeName
          ? {
              attributeName: mutation.attributeName,
              value: (mutation.target as Element).getAttribute(mutation.attributeName),
            }
          : null,
      };

      this.callback({
        mutation: mutationRecord,
        documentTime: this.getDocumentTime(),
      });

      this.removeKnownNodesInMutation(mutation);
    }
  }

  private addKnownNodesInMutation(mutation: MutationRecord): void {
    const targetNode = mutation.target as Element | Text;
    const virtualDomElement = this.realElementToVirtualElement.get(targetNode);
    if (!virtualDomElement) {
      throw new Error(
        "Unknown node in addKnownNodesInMutation:" + targetNode + "," + mutation.type,
      );
    }
    if (mutation.type === "childList") {
      let previousSibling = mutation.previousSibling;
      let index = 0;
      while (previousSibling && this.isIgnoredElement(previousSibling as Element | Text)) {
        previousSibling = previousSibling.previousSibling;
      }
      if (previousSibling) {
        const previousSiblingElement = this.realElementToVirtualElement.get(
          previousSibling as Element | Text,
        );
        if (!previousSiblingElement) {
          throw new Error("Unknown previous sibling");
        }
        index = virtualDomElement.childNodes.indexOf(previousSiblingElement);
        if (index === -1) {
          throw new Error("Previous sibling is not currently a child of the parent element");
        }
        index += 1;
      }
      mutation.addedNodes.forEach((node: Node) => {
        const asElementOrText = node as Element | Text;
        const childVirtualDomElement = this.createVirtualDomElementWithChildren(
          asElementOrText,
          virtualDomElement,
        );
        if (childVirtualDomElement) {
          if (virtualDomElement.childNodes.indexOf(childVirtualDomElement) === -1) {
            virtualDomElement.childNodes.splice(index, 0, childVirtualDomElement);
            index++;
          }
        }
      });
    } else if (mutation.type === "attributes") {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const attributeName = mutation.attributeName!;
      if (this.isIgnoredAttribute(targetNode, attributeName)) {
        return;
      }
      const attributeValue = (targetNode as Element).getAttribute(attributeName);
      if (attributeValue === null) {
        delete virtualDomElement.attributes[attributeName];
      } else {
        virtualDomElement.attributes[attributeName] = attributeValue;
      }
    } else if (mutation.type === "characterData") {
      virtualDomElement.textContent = targetNode.textContent ? targetNode.textContent : undefined;
    }
  }

  private removeKnownNodesInMutation(mutation: MutationRecord): void {
    const targetNode = mutation.target as Element | Text;
    const virtualDomElement = this.realElementToVirtualElement.get(targetNode);
    if (!virtualDomElement) {
      throw new Error("Unknown node in mutation list:" + targetNode + ", " + mutation.type);
    }
    if (mutation.type === "childList") {
      for (const node of mutation.removedNodes) {
        const asElementOrText = node as Element | Text;
        if (this.isIgnoredElement(asElementOrText)) {
          continue;
        }
        const childDomElement = this.realElementToVirtualElement.get(asElementOrText);
        if (!childDomElement) {
          console.warn(this.htmlPath, "Unknown node in removeKnownNodesInMutation");
          continue;
        } else {
          this.removeVirtualDomElement(childDomElement);
          const index = virtualDomElement.childNodes.indexOf(childDomElement);
          virtualDomElement.childNodes.splice(index, 1);
        }
      }
      return;
    }
  }

  private removeVirtualDomElement(virtualDomElement: LiveVirtualDomElement): void {
    this.nodeIdToNode.delete(virtualDomElement.nodeId);
    this.nodeToNodeId.delete(virtualDomElement);
    this.realElementToVirtualElement.delete(virtualDomElement.realElement);
    for (const child of virtualDomElement.childNodes) {
      this.removeVirtualDomElement(child);
    }
  }

  private createVirtualDomElementWithChildren(
    node: Element | Text,
    parent: LiveVirtualDomElement | null,
  ): LiveVirtualDomElement | null {
    const virtualElement = this.createVirtualDomElement(node, parent);
    if (!virtualElement) {
      return null;
    }
    if ((node as Element).childNodes) {
      for (let i = 0; i < (node as Element).childNodes.length; i++) {
        const child = (node as Element).childNodes[i];
        const childVirtualElement = this.createVirtualDomElementWithChildren(
          child as Element | Text,
          virtualElement,
        );
        if (childVirtualElement) {
          virtualElement.childNodes.push(childVirtualElement);
        }
      }
    }

    return virtualElement;
  }

  private createVirtualDomElement(
    node: Element | Text,
    parent: LiveVirtualDomElement | null,
  ): LiveVirtualDomElement | null {
    if (this.isIgnoredElement(node)) {
      return null;
    }
    const existingValue = this.realElementToVirtualElement.get(node);
    if (existingValue !== undefined) {
      throw new Error("Node already has a virtual element: " + node.nodeName);
    }
    if (!node) {
      throw new Error("Cannot assign node id to null");
    }

    const attributes: { [key: string]: string } = {};
    if ((node as any).attributes) {
      const asHTMLElement = node as HTMLElement;
      for (const key of asHTMLElement.getAttributeNames()) {
        const value = asHTMLElement.getAttribute(key);
        if (value === null) {
          throw new Error("Null attribute value for key: " + key);
        }
        if (!this.isIgnoredAttribute(node, key)) {
          attributes[key] = value;
        }
      }
    }

    const nodeId = this.nextNodeId++;
    const virtualElement: LiveVirtualDomElement = {
      nodeId,
      tag: node.nodeName,
      attributes,
      childNodes: [],
      realElement: node,
      parent,
    };
    if (node instanceof this.domRunner.getWindow().Text && node.textContent) {
      virtualElement.textContent = node.textContent;
    }
    this.nodeToNodeId.set(virtualElement, nodeId);
    this.nodeIdToNode.set(nodeId, virtualElement);
    this.realElementToVirtualElement.set(node, virtualElement);
    return virtualElement;
  }

  private getFirstNonIgnoredPreviousSibling(node: Element | Text): Element | Text | null {
    let currentNode = node;
    if (!this.isIgnoredElement(currentNode)) {
      return currentNode;
    }
    while (currentNode && currentNode.previousSibling) {
      currentNode = currentNode.previousSibling as Element | Text;
      if (!this.isIgnoredElement(currentNode)) {
        return currentNode;
      }
    }
    return null;
  }

  private getVirtualDomElementForRealElementOrThrow(
    realElement: Element | Text,
  ): LiveVirtualDomElement {
    const virtualElement = this.realElementToVirtualElement.get(realElement);
    if (!virtualElement) {
      throw new Error(`Virtual element not found for real element`);
    }
    return virtualElement;
  }

  private isIgnoredElement(node: Element | Text): boolean {
    if (this.ignoreTextNodes && node instanceof this.domRunner.getWindow().Text) {
      return true;
    } else if (node instanceof this.domRunner.getWindow().HTMLScriptElement) {
      return true;
    } else if (node instanceof this.domRunner.getWindow().Comment) {
      return true;
    }
    return false;
  }

  private isIgnoredAttribute(node: Element | Text, attributeName: string): boolean {
    return attributeName.startsWith("on");
  }

  public dispatchRemoteEventFromConnectionId(connectionId: number, remoteEvent: RemoteEvent): void {
    const domNode = this.nodeIdToNode.get(remoteEvent.nodeId);
    if (!domNode) {
      console.error("Unknown node ID in remote event: " + remoteEvent.nodeId);
      return;
    }

    if (domNode instanceof this.domRunner.getWindow().Text) {
      console.warn("Cannot dispatch remote event to text node");
      return;
    }

    this.domRunner.dispatchRemoteEventFromConnectionId(
      connectionId,
      domNode.realElement as Element,
      remoteEvent,
    );
  }

  public dispose() {
    clearInterval(this.documentTimeIntervalTimer);
    this.domRunner.dispose();
  }

  private getDocumentTime() {
    return this.domRunner.getDocumentTime();
  }
}
