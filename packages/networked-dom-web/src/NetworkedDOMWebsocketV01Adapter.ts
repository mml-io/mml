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

import { IDocumentFactory, IElementLike, INodeLike } from "./DocumentInterface";
import {
  createElementWithSVGSupport,
  getChildrenTarget,
  getRemovalTarget,
  setElementAttribute,
} from "./ElementUtils";
import { isHTMLElement, isText, NetworkedDOMWebsocketOptions } from "./NetworkedDOMWebsocket";
import { NetworkedDOMWebsocketAdapterBase } from "./NetworkedDOMWebsocketAdapterBase";
import {
  bufferPortalChild,
  flushPendingPortalChildren,
  recordFactoryOverride,
  resolveChildFactory,
  resolvePortalChildFactory,
} from "./PortalUtils";

export class NetworkedDOMWebsocketV01Adapter extends NetworkedDOMWebsocketAdapterBase {
  constructor(
    websocket: WebSocket,
    parentElement: IElementLike,
    connectedCallback: () => void,
    timeCallback?: (time: number) => void,
    options: NetworkedDOMWebsocketOptions = {},
    doc?: IDocumentFactory,
  ) {
    super(websocket, parentElement, connectedCallback, timeCallback, options, doc);
  }

  public handleEvent(element: IElementLike, event: CustomEvent) {
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

  receiveMessage(event: MessageEvent) {
    try {
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
                this.connectedCallback();
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
    } catch (e) {
      console.error("Error handling websocket message", e);
      // Close the websocket to avoid processing any more messages in this invalid state (1011 = "Internal Error")
      this.websocket.close(1011, "Error handling websocket message");
      throw e;
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
    const parentNode = this.idToElement.get(nodeId);
    if (!parentNode) {
      throw new Error("No parent found for childrenChanged message");
    }
    if (!isHTMLElement(parentNode, this.parentElement)) {
      throw new Error("Parent is not an HTMLElement (that supports children)");
    }

    const childFactory = resolveChildFactory(parentNode, this.elementFactoryOverride);
    const targetForChildren = getChildrenTarget(parentNode);

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
      const childElement = this.handleNewElement(addedNode, childFactory);
      if (childElement) {
        elementsToAdd.push(childElement);
      }
    }
    this.insertElements(
      targetForChildren,
      elementsToAdd,
      previousElement,
      nextElement,
      childFactory ?? this.docFactory,
    );
    if (this.pendingPortalChildren.size > 0) {
      flushPendingPortalChildren(this.pendingPortalChildren);
    }

    for (const removedNode of removedNodes) {
      const childElement = this.idToElement.get(removedNode);
      if (!childElement) {
        throw new Error(`Child element not found: ${removedNode}`);
      }
      this.elementToId.delete(childElement);
      this.idToElement.delete(removedNode);
      const targetForRemoval = getRemovalTarget(parentNode);
      targetForRemoval.removeChild(childElement);
      if (isHTMLElement(childElement, this.parentElement)) {
        // If child is capable of supporting children then remove any that exist
        this.removeChildElementIds(childElement);
      }
    }
  }

  private handleSnapshot(message: NetworkedDOMV01SnapshotMessage) {
    const element = this.handleNewElement(message.snapshot);
    if (!element) {
      throw new Error("Snapshot element not created");
    }
    this.resetAndApplySnapshot(element);
  }

  private handleAttributeChange(message: NetworkedDOMV01AttributeChangedDiff) {
    const { nodeId, attribute, newValue } = message;
    if (nodeId === undefined || nodeId === null) {
      console.warn("No nodeId in attributeChange message");
      return;
    }
    const node = this.idToElement.get(nodeId);
    if (node) {
      if (isHTMLElement(node, this.parentElement)) {
        if (newValue === null) {
          node.removeAttribute(attribute);
        } else {
          setElementAttribute(node, attribute, newValue);
        }
      } else {
        console.error("Element is not an HTMLElement and cannot support attributes", node);
      }
    } else {
      console.error("No element found for attributeChange message");
    }
  }

  private handleNewElement(
    message: NetworkedDOMV01NodeDescription,
    factoryOverride?: IDocumentFactory,
  ): INodeLike | null {
    const factory = factoryOverride ?? this.docFactory;

    if (message.type === "text") {
      return this.createTextNode(message.nodeId, message.text, factory);
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
      return this.createTextNode(nodeId, text || "", factory);
    }

    let element;
    try {
      element = createElementWithSVGSupport(tag, this.options, factory);
    } catch (e) {
      console.error(`Error creating element: (${tag})`, e);
      element = factory.createElement("x-div");
    }
    this.idToElement.set(nodeId, element);
    this.elementToId.set(element, nodeId);
    for (const key in attributes) {
      const value = attributes[key];
      setElementAttribute(element, key, value);
    }

    recordFactoryOverride(element, factory, this.docFactory, this.elementFactoryOverride);

    const { childFactory, usingPortalFactory } = resolvePortalChildFactory(element, factory);

    if (children) {
      for (const child of children) {
        const childElement = this.handleNewElement(child, childFactory);
        if (childElement) {
          if (usingPortalFactory) {
            bufferPortalChild(this.pendingPortalChildren, element, childElement);
          } else {
            element.append(childElement);
          }
        }
      }
    }
    return element;
  }
}
