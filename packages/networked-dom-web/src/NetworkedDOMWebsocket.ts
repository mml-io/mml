import {
  AttributeChangedDiff,
  ChildrenChangedDiff,
  ClientMessage,
  NodeDescription,
  RemoteEvent,
  ServerMessage,
  SnapshotMessage,
  TextChangedDiff,
} from "@mml-io/networked-dom-protocol";

import { DOMSanitizer } from "./DOMSanitizer";

const websocketProtocol = "networked-dom-v0.1";

const startingBackoffTimeMilliseconds = 100;
const maximumBackoffTimeMilliseconds = 10000;
const maximumWebsocketConnectionTimeout = 5000;

export type NetworkedDOMWebsocketFactory = (url: string) => WebSocket;

export enum NetworkedDOMWebsocketStatus {
  Connecting,
  Connected,
  Reconnecting,
  Disconnected,
}

/**
 * NetworkedDOMWebsocket is a client for a NetworkedDOMServer. It connects to a server on the provided url and receives
 * updates to the DOM. It also sends events to the server for interactions with the DOM.
 *
 * The NetworkedDOMWebsocket is attached to a parentElement and synchronizes the received DOM under that element.
 */
export class NetworkedDOMWebsocket {
  private idToElement = new Map<number, Node>();
  private elementToId = new Map<Node, number>();
  private websocket: WebSocket | null = null;
  private currentRoot: HTMLElement | null = null;

  private url: string;
  private websocketFactory: NetworkedDOMWebsocketFactory;
  private parentElement: HTMLElement;
  private timeCallback: (time: number) => void;
  private statusUpdateCallback: (status: NetworkedDOMWebsocketStatus) => void;
  private stopped = false;
  private backoffTime = startingBackoffTimeMilliseconds;
  private status: NetworkedDOMWebsocketStatus | null = null;

  public static createWebSocket(url: string): WebSocket {
    return new WebSocket(url, [websocketProtocol]);
  }

  constructor(
    url: string,
    websocketFactory: NetworkedDOMWebsocketFactory,
    parentElement: HTMLElement,
    timeCallback?: (time: number) => void,
    statusUpdateCallback?: (status: NetworkedDOMWebsocketStatus) => void,
  ) {
    this.url = url;
    this.websocketFactory = websocketFactory;
    this.parentElement = parentElement;
    this.timeCallback =
      timeCallback ||
      (() => {
        // no-op
      });
    this.statusUpdateCallback =
      statusUpdateCallback ||
      (() => {
        // no-op
      });
    this.setStatus(NetworkedDOMWebsocketStatus.Connecting);
    this.startWebSocketConnectionAttempt();
  }

  private setStatus(status: NetworkedDOMWebsocketStatus) {
    if (this.status !== status) {
      this.status = status;
      this.statusUpdateCallback(status);
    }
  }

  private isHTMLElement(node: unknown): node is HTMLElement {
    if (node instanceof HTMLElement) {
      return true;
    }
    if (!this.parentElement.ownerDocument.defaultView) {
      return false;
    }
    return node instanceof this.parentElement.ownerDocument.defaultView.HTMLElement;
  }

  private isText(node: unknown): node is Text {
    if (node instanceof Text) {
      return true;
    }
    if (!this.parentElement.ownerDocument.defaultView) {
      return false;
    }
    return node instanceof this.parentElement.ownerDocument.defaultView.Text;
  }

  private createWebsocketWithTimeout(timeout: number): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("websocket connection timed out"));
      }, timeout);
      const websocket = this.websocketFactory(this.url);
      websocket.addEventListener("open", () => {
        clearTimeout(timeoutId);

        this.websocket = websocket;

        websocket.addEventListener("message", (event) => {
          if (websocket !== this.websocket) {
            console.log("Ignoring websocket message event because it is no longer current");
            websocket.close();
            return;
          }
          this.handleIncomingWebsocketMessage(event);
        });

        const onWebsocketClose = async () => {
          const hadContents = this.currentRoot !== null;
          this.clearContents();
          if (this.stopped) {
            // This closing is expected. The client closed the websocket.
            this.setStatus(NetworkedDOMWebsocketStatus.Disconnected);
            return;
          }
          if (!hadContents) {
            // The websocket did not deliver any contents. It may have been successfully opened, but immediately closed. This client should back off to prevent this happening in a rapid loop.
            await this.waitBackoffTime();
          }
          // The websocket closed unexpectedly. Try to reconnect.
          this.setStatus(NetworkedDOMWebsocketStatus.Reconnecting);
          this.startWebSocketConnectionAttempt();
        };

        websocket.addEventListener("close", (e) => {
          if (websocket !== this.websocket) {
            console.warn("Ignoring websocket close event because it is no longer current");
            return;
          }
          console.log("NetworkedDOMWebsocket close", e);
          onWebsocketClose();
        });
        websocket.addEventListener("error", (e) => {
          if (websocket !== this.websocket) {
            console.log("Ignoring websocket error event because it is no longer current");
            return;
          }
          console.error("NetworkedDOMWebsocket error", e);
          onWebsocketClose();
        });

        resolve(websocket);
      });
      websocket.addEventListener("error", (e) => {
        clearTimeout(timeoutId);
        reject(e);
      });
    });
  }

  private async waitBackoffTime(): Promise<void> {
    console.warn(`Websocket connection to '${this.url}' failed: retrying in ${this.backoffTime}ms`);
    await new Promise((resolve) => setTimeout(resolve, this.backoffTime));
    this.backoffTime = Math.min(
      // Introduce a small amount of randomness to prevent clients from retrying in lockstep
      this.backoffTime * (1.5 + Math.random() * 0.5),
      maximumBackoffTimeMilliseconds,
    );
  }

  private async startWebSocketConnectionAttempt() {
    if (this.stopped) {
      return;
    }
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.stopped) {
        return;
      }
      try {
        await this.createWebsocketWithTimeout(maximumWebsocketConnectionTimeout);
        break;
      } catch (e) {
        // Connection failed, retry with backoff
        this.setStatus(NetworkedDOMWebsocketStatus.Reconnecting);
        await this.waitBackoffTime();
      }
    }
  }

  private handleIncomingWebsocketMessage(event: MessageEvent) {
    const messages = JSON.parse(event.data) as Array<ServerMessage>;
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

  public stop() {
    this.stopped = true;
    if (this.websocket !== null) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  public handleEvent(element: HTMLElement, event: CustomEvent<{ element: HTMLElement }>) {
    const nodeId = this.elementToId.get(element);
    if (nodeId === undefined || nodeId === null) {
      throw new Error("Element not found");
    }

    console.log(
      `Sending event to websocket: "${event.type}" on node: ${nodeId} type: ${element.tagName}`,
    );

    const detailWithoutElement: Partial<typeof event.detail> = {
      ...event.detail,
    };
    delete detailWithoutElement.element;

    const remoteEvent: RemoteEvent = {
      type: "event",
      nodeId,
      name: event.type,
      bubbles: event.bubbles,
      params: detailWithoutElement,
    };

    this.send(remoteEvent);
  }

  private send(fromClientMessage: ClientMessage) {
    if (!this.websocket) {
      throw new Error("No websocket created");
    }
    this.websocket.send(JSON.stringify(fromClientMessage));
  }

  private handleTextChanged(message: TextChangedDiff) {
    const { nodeId, text } = message;

    if (nodeId === undefined || nodeId === null) {
      console.warn("No nodeId in textChanged message");
      return;
    }
    const node = this.idToElement.get(nodeId);
    if (!node) {
      throw new Error("No node found for textChanged message");
    }
    if (!this.isText(node)) {
      throw new Error("Node for textChanged message is not a Text node");
    }
    node.textContent = text;
  }

  private handleChildrenChanged(message: ChildrenChangedDiff) {
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
    if (!this.isHTMLElement(parent)) {
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
      if (this.isHTMLElement(childElement)) {
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

  private handleSnapshot(message: SnapshotMessage) {
    // This websocket is successfully connected. Reset the backoff time.
    this.backoffTime = startingBackoffTimeMilliseconds;

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
    if (!this.isHTMLElement(element)) {
      throw new Error("Snapshot element is not an HTMLElement");
    }
    this.currentRoot = element;
    // appending to the tree causes MElements to be constructed
    this.parentElement.append(element);

    this.setStatus(NetworkedDOMWebsocketStatus.Connected);
  }

  private handleAttributeChange(message: AttributeChangedDiff) {
    const { nodeId, attribute, newValue } = message;
    if (nodeId === undefined || nodeId === null) {
      console.warn("No nodeId in attributeChange message");
      return;
    }
    const element = this.idToElement.get(nodeId);
    if (element) {
      if (this.isHTMLElement(element)) {
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

  private handleNewElement(message: NodeDescription): Node | null {
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
      element = document.createElement(tag);
    } catch (e) {
      console.error(`Error creating element: (${tag})`, e);
      element = document.createElement("div");
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

  private clearContents() {
    this.idToElement.clear();
    this.elementToId.clear();
    if (this.currentRoot) {
      this.currentRoot.remove();
      this.currentRoot = null;
    }
  }
}
