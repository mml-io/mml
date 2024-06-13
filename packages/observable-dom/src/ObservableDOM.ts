import {
  LogMessage,
  ObservableDOMInterface,
  ObservableDOMMessage,
  ObservableDOMParameters,
  RemoteEvent,
  StaticVirtualDOMElement,
  StaticVirtualDOMMutationIdsRecord,
} from "@mml-io/observable-dom-common";

import { virtualDOMElementToStatic } from "./utils";

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

export type LiveVirtualDOMElement = Omit<StaticVirtualDOMElement, "childNodes"> & {
  realElement: Element | Text;
  childNodes: Array<LiveVirtualDOMElement>;
  parent: LiveVirtualDOMElement | null;
};

/**
 * The ObservableDOM class handles the running of an HTML document using a provided DOMRunnerFactory and converting the
 * mutations that are structured as references to live DOM elements into messages that refer to elements by nodeIds.
 */
export class ObservableDOM implements ObservableDOMInterface {
  private nodeToNodeId = new Map<LiveVirtualDOMElement, number>();
  private nodeIdToNode = new Map<number, LiveVirtualDOMElement>();
  private realElementToVirtualElement = new Map<Element | Text, LiveVirtualDOMElement>();
  private ignoreTextNodes = true;
  private callback: (message: ObservableDOMMessage, observableDOM: ObservableDOMInterface) => void;
  private nextNodeId = 1;
  private htmlPath: string;
  private domRunner: DOMRunnerInterface;
  private loaded = false;
  private preLoadLogMessages: Array<LogMessage> = [];

  private documentTimeIntervalTimer: NodeJS.Timeout;

  constructor(
    observableDOMParameters: ObservableDOMParameters,
    callback: (message: ObservableDOMMessage, observableDOM: ObservableDOMInterface) => void,
    runnerFactory: DOMRunnerFactory,
  ) {
    this.htmlPath = observableDOMParameters.htmlPath;
    this.ignoreTextNodes = observableDOMParameters.ignoreTextNodes;
    this.callback = callback;

    this.documentTimeIntervalTimer = setInterval(() => {
      this.callback(
        {
          documentTime: this.getDocumentTime(),
        },
        this,
      );
    }, observableDOMParameters.pingIntervalMilliseconds || 5000);

    this.domRunner = runnerFactory(
      observableDOMParameters.htmlPath,
      observableDOMParameters.htmlContents,
      observableDOMParameters.params,
      (domRunnerMessage: DOMRunnerMessage) => {
        if (domRunnerMessage.loaded) {
          this.loaded = true;
          this.createVirtualDOMElementWithChildren(
            this.domRunner.getDocument() as unknown as Element,
            null,
          );

          const snapshot = virtualDOMElementToStatic(
            this.getVirtualDOMElementForRealElementOrThrow(
              this.domRunner.getDocument() as unknown as Element,
            ),
          );

          this.callback(
            {
              snapshot,
              documentTime: this.getDocumentTime(),
            },
            this,
          );
          for (const logMessage of this.preLoadLogMessages) {
            this.callback(
              {
                logMessage,
                documentTime: this.getDocumentTime(),
              },
              this,
            );
          }
          this.preLoadLogMessages = [];
        } else if (domRunnerMessage.mutationList) {
          this.processModificationList(domRunnerMessage.mutationList);
        } else if (domRunnerMessage.logMessage) {
          if (!this.loaded) {
            this.preLoadLogMessages.push(domRunnerMessage.logMessage);
            return;
          }
          this.callback(
            {
              logMessage: domRunnerMessage.logMessage,
              documentTime: this.getDocumentTime(),
            },
            this,
          );
        }
      },
    );
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
    const documentVirtualDOMElement = this.realElementToVirtualElement.get(documentEl);
    if (!documentVirtualDOMElement) {
      throw new Error(`document not created in processModificationList`);
    }

    if (mutationList.length > 1) {
      // TODO (https://github.com/mml-io/mml/issues/100) - walk back through the records to derive the intermediate
      //  states (e.g. if an attribute is later added to an element created in an earlier record then it should not
      //  have that attribute when the element is added. This is important as incorrect attribute sets can affect
      //  visibility and expected client performance.
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

      const targetNode = mutation.target as Element | Text;
      const targetElement = this.realElementToVirtualElement.get(targetNode);
      if (!targetElement) {
        throw new Error("Unknown node:" + targetNode + "," + mutation.type);
      }

      let firstNonIgnoredPreviousSibling: Element | Text | null = mutation.previousSibling as
        | Element
        | Text;
      let insertionIndex = 0;
      while (
        firstNonIgnoredPreviousSibling &&
        this.isIgnoredElement(firstNonIgnoredPreviousSibling as Element | Text)
      ) {
        firstNonIgnoredPreviousSibling = firstNonIgnoredPreviousSibling.previousSibling as
          | Element
          | Text
          | null;
      }
      let previousSiblingElement: LiveVirtualDOMElement | undefined = undefined;
      if (firstNonIgnoredPreviousSibling) {
        previousSiblingElement = this.realElementToVirtualElement.get(
          firstNonIgnoredPreviousSibling as Element | Text,
        );
        if (!previousSiblingElement) {
          throw new Error("Unknown previous sibling");
        }
        insertionIndex = targetElement.childNodes.indexOf(previousSiblingElement);
        if (insertionIndex === -1) {
          throw new Error("Previous sibling is not currently a child of the parent element");
        }
        insertionIndex += 1;
      }
      const toAdd: Array<LiveVirtualDOMElement> = [];
      const removedNodeIds: Array<number> = [];

      if (mutation.type === "childList") {
        mutation.removedNodes.forEach((node: Node) => {
          const asElementOrText = node as Element | Text;
          if (this.isIgnoredElement(asElementOrText)) {
            return;
          }
          const childDOMElement = this.realElementToVirtualElement.get(asElementOrText);
          if (!childDOMElement) {
            /*
             This can happen if element was a child of a parent element, but was moved to a new parent in the same batch of mutations.
             We can ignore this removal as the element will be in the correct place in the hierarchy already.
            */
            return;
          } else {
            const index = targetElement.childNodes.indexOf(childDOMElement);
            if (index === -1) {
              /*
             This can happen if element was a child of a parent element, but was moved to a new parent in the same batch of mutations.
             We can ignore this removal as the element will be in the correct place in the hierarchy already.
            */
            } else {
              this.removeVirtualDOMElement(childDOMElement);
              removedNodeIds.push(childDOMElement.nodeId);
              const removal = targetElement.childNodes.splice(index, 1);
              if (removal.length !== 1) {
                throw new Error("Removal length not 1");
              } else {
                if (removal[0].nodeId !== childDOMElement.nodeId) {
                  throw new Error("Removal node id mismatch");
                }
              }
            }
          }
        });

        mutation.addedNodes.forEach((node: Node) => {
          const asElementOrText = node as Element | Text;
          if (asElementOrText.parentNode !== targetNode) {
            // Ignore this addition - it is likely overridden by an earlier addition of this element to its eventual node in this mutation batch
          } else {
            const childVirtualDOMElement = this.createVirtualDOMElementWithChildren(
              asElementOrText,
              targetElement,
            );
            if (childVirtualDOMElement) {
              toAdd.push(childVirtualDOMElement);
            }
          }
        });
        targetElement.childNodes.splice(insertionIndex, 0, ...toAdd);
      } else if (mutation.type === "attributes") {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const attributeName = mutation.attributeName!;
        if (!this.isIgnoredAttribute(targetNode, attributeName)) {
          const attributeValue = (targetNode as Element).getAttribute(attributeName);
          if (attributeValue === null) {
            delete targetElement.attributes[attributeName];
          } else {
            targetElement.attributes[attributeName] = attributeValue;
          }
        }
      } else if (mutation.type === "characterData") {
        targetElement.textContent = targetNode.textContent ? targetNode.textContent : undefined;
      }

      // Convert the "real" DOM MutationRecord into a "virtual" DOM MutationRecord that references the VirtualDOMElements
      // This is done so that the same process for handling mutations can be used for both changes to a live DOM and also
      // to diffs between DOM snapshots when reloading

      const addedNodes: Array<StaticVirtualDOMElement> = toAdd.map(virtualDOMElementToStatic);

      const mutationRecord: StaticVirtualDOMMutationIdsRecord = {
        type: mutation.type,
        targetId: targetElement.nodeId,
        addedNodes,
        removedNodeIds,
        previousSiblingId: previousSiblingElement ? previousSiblingElement.nodeId : null,
        attribute: mutation.attributeName
          ? {
              attributeName: mutation.attributeName,
              value: (mutation.target as Element).getAttribute(mutation.attributeName),
            }
          : null,
      };

      this.callback(
        {
          mutation: mutationRecord,
          documentTime: this.getDocumentTime(),
        },
        this,
      );
    }
  }

  private removeVirtualDOMElement(virtualDOMElement: LiveVirtualDOMElement): void {
    this.nodeIdToNode.delete(virtualDOMElement.nodeId);
    this.nodeToNodeId.delete(virtualDOMElement);
    this.realElementToVirtualElement.delete(virtualDOMElement.realElement);
    for (const child of virtualDOMElement.childNodes) {
      this.removeVirtualDOMElement(child);
    }
  }

  private createVirtualDOMElementWithChildren(
    node: Element | Text,
    parent: LiveVirtualDOMElement | null,
  ): LiveVirtualDOMElement | null {
    const [virtualElement, existing] = this.createVirtualDOMElement(node, parent);
    if (!virtualElement) {
      return null;
    }
    if (existing) {
      return null;
    }
    if ((node as Element).childNodes) {
      for (let i = 0; i < (node as Element).childNodes.length; i++) {
        const child = (node as Element).childNodes[i];
        const childVirtualElement = this.createVirtualDOMElementWithChildren(
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

  private createVirtualDOMElement(
    node: Element | Text,
    parent: LiveVirtualDOMElement | null,
  ): [LiveVirtualDOMElement | null, boolean] {
    if (this.isIgnoredElement(node)) {
      return [null, false];
    }
    if (!node) {
      throw new Error("Cannot assign node id to null");
    }

    const existingValue = this.realElementToVirtualElement.get(node);
    if (existingValue !== undefined) {
      /*
       This is undesirable, but the batching of mutations from MutationObserver means that
       this node could be being added in a mutation after a mutation of a parent that when
       handled resulting in adding this node early.
      */
      return [existingValue, true];
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
    const virtualElement: LiveVirtualDOMElement = {
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
    return [virtualElement, false];
  }

  private getVirtualDOMElementForRealElementOrThrow(
    realElement: Element | Text,
  ): LiveVirtualDOMElement {
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
