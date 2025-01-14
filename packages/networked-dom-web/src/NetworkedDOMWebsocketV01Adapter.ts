import {
  NetworkedDOMV01AttributeChangedDiff,
  NetworkedDOMV01ChildrenChangedDiff,
  NetworkedDOMV01ClientMessage,
  NetworkedDOMV01NodeDescription,
  NetworkedDOMV01RemoteEvent,
  NetworkedDOMV01ServerMessage,
  NetworkedDOMV01SnapshotMessage,
  NetworkedDOMV01TextChangedDiff,
} from "@mml-io/networked-dom-protocol";

import { DOMSanitizer } from "./DOMSanitizer";
import {
  isHTMLElement,
  isText,
  NetworkedDOMWebsocketAdapter,
  NetworkedDOMWebsocketOptions,
} from "./NetworkedDOMWebsocket";

export class NetworkedDOMWebsocketV01Adapter implements NetworkedDOMWebsocketAdapter {
  private idToElement = new Map<number, Node>();
  private elementToId = new Map<Node, number>();
  private currentRoot: HTMLElement | null = null;

  constructor(
    private websocket: WebSocket,
    private parentElement: HTMLElement,
    private timeCallback?: (time: number) => void,
    private options: NetworkedDOMWebsocketOptions = {},
  ) {
    this.websocket.binaryType = "arraybuffer";
  }

  public handleEvent(element: HTMLElement, event: CustomEvent<{ element: HTMLElement }>) {
    const nodeId = this.elementToId.get(element);
    if (nodeId === undefined || nodeId === null) {
      throw new Error("Element not found");
    }

    const detailWithoutElement: Partial<typeof event.detail> = {
      ...event.detail,
    };
    delete detailWithoutElement.element;

    const remoteEvent: NetworkedDOMV01RemoteEvent = {
      type: "event",
      nodeId,
      name: event.type,
      bubbles: event.bubbles,
      params: detailWithoutElement,
    };

    this.send(remoteEvent);
  }

  private send(fromClientMessage: NetworkedDOMV01ClientMessage) {
    this.websocket.send(JSON.stringify(fromClientMessage));
  }

  public clearContents(): boolean {
    this.idToElement.clear();
    this.elementToId.clear();
    if (this.currentRoot) {
      this.currentRoot.remove();
      this.currentRoot = null;
      return true;
    }
    return false;
  }

  receiveMessage(event: MessageEvent) {
    const messages = JSON.parse(event.data) as Array<NetworkedDOMV01ServerMessage>;
    for (const message of messages) {
      switch (message.type) {
        case "error":
          console.error("Error from server", message);
          break;
        case "warning":
          console.warn("Warning from server", message);
          break;
        default: {
          if (message.documentTime) {
            if (this.timeCallback) {
              this.timeCallback(message.documentTime);
            }
          }
          switch (message.type) {
            case "snapshot":
              this.handleSnapshot(message);
              break;
            case "attributeChange":
              this.handleAttributeChange(message);
              break;
            case "childrenChanged":
              this.handleChildrenChanged(message);
              break;
            case "textChanged":
              this.handleTextChanged(message);
              break;
            case "ping":
              this.send({
                type: "pong",
                pong: message.ping,
              });
              break;
            default:
              console.warn("unknown message type", message);
              break;
          }
        }
      }
    }
  }

  private handleTextChanged(message: NetworkedDOMV01TextChangedDiff) {
    const { nodeId, text } = message;

    if (nodeId === undefined || nodeId === null) {
      console.warn("No nodeId in textChanged message");
      return;
    }
    const node = this.idToElement.get(nodeId);
    if (!node) {
      throw new Error("No node found for textChanged message");
    }
    if (!isText(node, this.parentElement)) {
      throw new Error("Node for textChanged message is not a Text node");
    }
    node.textContent = text;
  }

  private handleChildrenChanged(message: NetworkedDOMV01ChildrenChangedDiff) {
    const { nodeId, addedNodes, removedNodes, previousNodeId } = message;
    if (nodeId === undefined || nodeId === null) {
      console.warn("No nodeId in childrenChanged message");
      return;
    }
    const parent = this.idToElement.get(nodeId);
    if (!parent) {
      throw new Error("No parent found for childrenChanged message");
    }
    if (!parent.isConnected) {
      console.error("Parent is not connected", parent);
    }
    if (!isHTMLElement(parent, this.parentElement)) {
      throw new Error("Parent is not an HTMLElement (that supports children)");
    }
    let nextElement = null;
    let previousElement = null;
    if (previousNodeId) {
      previousElement = this.idToElement.get(previousNodeId);
      if (!previousElement) {
        throw new Error("No previous element found for childrenChanged message");
      }
      nextElement = previousElement.nextSibling;
    }

    const elementsToAdd = [];
    for (const addedNode of addedNodes) {
      const childElement = this.handleNewElement(addedNode);
      if (childElement) {
        elementsToAdd.push(childElement);
      }
    }
    if (elementsToAdd.length) {
      if (previousElement) {
        if (nextElement) {
          // There is a previous and next element - insertBefore the next element
          const docFrag = new DocumentFragment();
          docFrag.append(...elementsToAdd);
          parent.insertBefore(docFrag, nextElement);
        } else {
          // No next element - must be the last children
          parent.append(...elementsToAdd);
        }
      } else {
        // No previous element - must be the first children
        parent.prepend(...elementsToAdd);
      }
    }
    for (const removedNode of removedNodes) {
      const childElement = this.idToElement.get(removedNode);
      if (!childElement) {
        throw new Error(`Child element not found: ${removedNode}`);
      }
      this.elementToId.delete(childElement);
      this.idToElement.delete(removedNode);
      parent.removeChild(childElement);
      if (isHTMLElement(childElement, this.parentElement)) {
        // If child is capable of supporting children then remove any that exist
        this.removeChildElementIds(childElement);
      }
    }
  }

  private removeChildElementIds(parent: HTMLElement) {
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i];
      const childId = this.elementToId.get(child as HTMLElement);
      if (!childId) {
        console.error("Inner child of removed element had no id", child);
      } else {
        this.elementToId.delete(child);
        this.idToElement.delete(childId);
      }
      this.removeChildElementIds(child as HTMLElement);
    }
  }

  private handleSnapshot(message: NetworkedDOMV01SnapshotMessage) {
    // This websocket is successfully connected. Reset the backoff time.
    if (this.currentRoot) {
      this.currentRoot.remove();
      this.currentRoot = null;
      this.elementToId.clear();
      this.idToElement.clear();
    }

    // create a tree of DOM elements
    // NOTE: the MElement constructors are not executed during this stage
    const element = this.handleNewElement(message.snapshot);
    if (!element) {
      throw new Error("Snapshot element not created");
    }
    if (!isHTMLElement(element, this.parentElement)) {
      throw new Error("Snapshot element is not an HTMLElement");
    }
    this.currentRoot = element;
    // appending to the tree causes MElements to be constructed
    this.parentElement.append(element);
  }

  private handleAttributeChange(message: NetworkedDOMV01AttributeChangedDiff) {
    const { nodeId, attribute, newValue } = message;
    if (nodeId === undefined || nodeId === null) {
      console.warn("No nodeId in attributeChange message");
      return;
    }
    const element = this.idToElement.get(nodeId);
    if (element) {
      if (isHTMLElement(element, this.parentElement)) {
        if (newValue === null) {
          element.removeAttribute(attribute);
        } else {
          if (DOMSanitizer.shouldAcceptAttribute(attribute)) {
            element.setAttribute(attribute, newValue);
          }
        }
      } else {
        console.error("Element is not an HTMLElement and cannot support attributes", element);
      }
    } else {
      console.error("No element found for attributeChange message");
    }
  }

  private handleNewElement(message: NetworkedDOMV01NodeDescription): Node | null {
    if (message.type === "text") {
      const { nodeId, text } = message;
      const textNode = document.createTextNode("");
      textNode.textContent = text;
      this.idToElement.set(nodeId, textNode);
      this.elementToId.set(textNode, nodeId);
      return textNode;
    }
    const { tag, nodeId, attributes, children, text } = message;
    if (nodeId === undefined || nodeId === null) {
      console.warn("No nodeId in handleNewElement message", message);
      return null;
    }
    if (this.idToElement.has(nodeId)) {
      console.error(
        "Received nodeId to add that is already present",
        nodeId,
        this.idToElement.get(nodeId),
      );
    }
    if (tag === "#text") {
      const textNode = document.createTextNode("");
      textNode.textContent = text || null;
      this.idToElement.set(nodeId, textNode);
      this.elementToId.set(textNode, nodeId);
      return textNode;
    }

    let element;
    try {
      let filteredTag = tag;
      if (this.options.tagPrefix) {
        if (!tag.toLowerCase().startsWith(this.options.tagPrefix.toLowerCase())) {
          filteredTag = this.options.replacementTagPrefix
            ? this.options.replacementTagPrefix + tag
            : `x-${tag}`;
        }
      }
      element = document.createElement(filteredTag);
    } catch (e) {
      console.error(`Error creating element: (${tag})`, e);
      element = document.createElement("x-div");
    }
    this.idToElement.set(nodeId, element);
    this.elementToId.set(element, nodeId);
    for (const key in attributes) {
      if (DOMSanitizer.shouldAcceptAttribute(key)) {
        const value = attributes[key];
        element.setAttribute(key, value);
      }
    }
    if (children) {
      for (const child of children) {
        const childElement = this.handleNewElement(child);
        if (childElement) {
          element.append(childElement);
        }
      }
    }
    return element;
  }
}
