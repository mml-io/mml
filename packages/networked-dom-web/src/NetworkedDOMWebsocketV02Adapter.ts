import {
  BufferReader,
  BufferWriter,
  decodeServerMessages,
  encodeClientMessage,
  getNetworkedDOMProtocolSubProtocol_v0_2SubversionOrThrow,
  networkedDOMProtocolSubProtocol_v0_2_Subversion,
  networkedDOMProtocolSubProtocol_v0_2_SubversionNumber,
  NetworkedDOMV02AttributesChangedDiff,
  NetworkedDOMV02ChangeHiddenFromDiff,
  NetworkedDOMV02ChildrenAddedDiff,
  NetworkedDOMV02ChildrenRemovedDiff,
  NetworkedDOMV02ClientMessage,
  NetworkedDOMV02DocumentTimeMessage,
  NetworkedDOMV02NodeDescription,
  NetworkedDOMV02PingMessage,
  NetworkedDOMV02RemoteEvent,
  NetworkedDOMV02ServerMessage,
  NetworkedDOMV02SnapshotMessage,
  NetworkedDOMV02TextChangedDiff,
} from "@mml-io/networked-dom-protocol";

import {
  createElementWithSVGSupport,
  getChildrenTarget,
  getRemovalTarget,
  setElementAttribute,
} from "./ElementUtils";
import {
  isHTMLElement,
  isText,
  NetworkedDOMWebsocketAdapter,
  NetworkedDOMWebsocketOptions,
} from "./NetworkedDOMWebsocket";

// This client uses a single connection id
const connectionId = 1;

// If an element should not be visible to this client, it will be replaced with this tag and attributes will be stored ready to be applied if it is unhidden.
const hiddenTag = "x-hidden";

export class NetworkedDOMWebsocketV02Adapter implements NetworkedDOMWebsocketAdapter {
  private idToElement = new Map<number, Node>();
  private elementToId = new Map<Node, number>();
  private placeholderToId = new Map<Node, number>();
  private hiddenPlaceholderElements = new Map<
    number,
    {
      placeholder: Node;
      element: Node;
    }
  >();
  private currentRoot: HTMLElement | null = null;
  private batchMode = false;
  private batchMessages: Array<NetworkedDOMV02ServerMessage> = [];
  private readonly protocolSubversion: networkedDOMProtocolSubProtocol_v0_2_SubversionNumber;

  constructor(
    private websocket: WebSocket,
    private parentElement: HTMLElement,
    private connectedCallback: () => void,
    private timeCallback?: (time: number) => void,
    private options: NetworkedDOMWebsocketOptions = {},
  ) {
    this.websocket.binaryType = "arraybuffer";
    this.protocolSubversion = getNetworkedDOMProtocolSubProtocol_v0_2SubversionOrThrow(
      websocket.protocol as networkedDOMProtocolSubProtocol_v0_2_Subversion,
    );
    this.send({
      type: "connectUsers",
      connectionIds: [connectionId],
      connectionTokens: [this.options.connectionToken ?? null],
    });
  }

  public handleEvent(element: HTMLElement, event: CustomEvent<{ element: HTMLElement }>) {
    const nodeId = this.elementToId.get(element);
    if (nodeId === undefined || nodeId === null) {
      console.error("Element not found for event", { nodeId, element, event });
      return;
    }

    const detailWithoutElement: Partial<typeof event.detail> = {
      ...event.detail,
    };
    delete detailWithoutElement.element;

    const remoteEvent: NetworkedDOMV02RemoteEvent = {
      type: "event",
      nodeId,
      connectionId,
      name: event.type,
      bubbles: event.bubbles,
      params: detailWithoutElement,
    };

    this.send(remoteEvent);
  }

  private send(message: NetworkedDOMV02ClientMessage) {
    const writer = new BufferWriter(256);
    encodeClientMessage(message, writer, this.protocolSubversion);
    this.websocket.send(writer.getBuffer());
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

  public receiveMessage(event: MessageEvent) {
    try {
      const reader = new BufferReader(new Uint8Array(event.data));
      const messages = decodeServerMessages(reader);
      for (const message of messages) {
        if (message.type === "batchStart") {
          // Need to wait for batchEnd before applying messages
          this.batchMode = true;
        } else if (message.type === "batchEnd") {
          // Apply all messages
          this.batchMode = false;
          for (const batchedMessage of this.batchMessages) {
            this.applyMessage(batchedMessage);
          }
          this.batchMessages = [];
        } else {
          if (this.batchMode) {
            this.batchMessages.push(message);
          } else {
            this.applyMessage(message);
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

  private applyMessage(message: NetworkedDOMV02ServerMessage) {
    switch (message.type) {
      case "error":
        console.error("Error from server", message);
        break;
      case "warning":
        console.warn("Warning from server", message);
        break;
      case "snapshot":
        this.handleSnapshot(message);
        this.connectedCallback();
        break;
      case "attributesChanged":
        this.handleAttributeChange(message);
        break;
      case "documentTime":
        this.handleDocumentTime(message);
        break;
      case "childrenAdded":
        this.handleChildrenAdded(message);
        break;
      case "changeHiddenFrom":
        this.handleChangeHiddenFrom(message);
        break;
      case "changeVisibleTo":
        // no-op for end user clients
        break;
      case "childrenRemoved":
        this.handleChildrenRemoved(message);
        break;
      case "textChanged":
        this.handleTextChanged(message);
        break;
      case "ping":
        this.handlePing(message);
        break;
      default:
        console.warn("unknown message type", message);
        break;
    }
  }

  private handleTextChanged(message: NetworkedDOMV02TextChangedDiff) {
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

  private handleChangeHiddenFrom(message: NetworkedDOMV02ChangeHiddenFromDiff) {
    const { nodeId, addHiddenFrom, removeHiddenFrom } = message;
    const node = this.idToElement.get(nodeId);
    const hiddenElement = this.hiddenPlaceholderElements.get(nodeId);
    if (addHiddenFrom.length > 0 && addHiddenFrom.indexOf(connectionId) !== -1) {
      // This element is being hidden
      if (hiddenElement) {
        // This element is already hidden
        return;
      }
      if (!node) {
        throw new Error("No node found for changeHiddenFrom message");
      }
      const parent = node.parentElement;
      if (!parent) {
        throw new Error("Node has no parent");
      }
      const placeholder = document.createElement(hiddenTag);
      parent.replaceChild(placeholder, node);
      this.hiddenPlaceholderElements.set(nodeId, { placeholder, element: node });
      this.placeholderToId.set(placeholder, nodeId);
    } else if (removeHiddenFrom.length > 0 && removeHiddenFrom.indexOf(connectionId) !== -1) {
      // This element is being unhidden
      if (!hiddenElement) {
        // This element is not hidden
        return;
      }
      const { placeholder, element } = hiddenElement;
      const parent = placeholder.parentElement;
      if (!parent) {
        throw new Error("Placeholder has no parent");
      }
      parent.replaceChild(element, placeholder);
      this.hiddenPlaceholderElements.delete(nodeId);
      this.placeholderToId.delete(placeholder);
    }
  }

  private handleChildrenAdded(message: NetworkedDOMV02ChildrenAddedDiff) {
    const { nodeId, addedNodes, previousNodeId } = message;
    if (nodeId === undefined || nodeId === null) {
      console.warn("No nodeId in childrenChanged message");
      return;
    }
    let parent = this.idToElement.get(nodeId);
    if (!parent) {
      throw new Error("No parent found for childrenChanged message");
    }

    const hiddenParent = this.hiddenPlaceholderElements.get(nodeId);
    if (hiddenParent) {
      // This element is hidden - add the children to the hidden element (not the placeholder)
      parent = hiddenParent.element;
    }
    if (!isHTMLElement(parent, this.parentElement)) {
      throw new Error("Parent is not an HTMLElement (that supports children)");
    }

    const targetForChildren = getChildrenTarget(parent);

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
          targetForChildren.insertBefore(docFrag, nextElement);
        } else {
          // No next element - must be the last children
          targetForChildren.append(...elementsToAdd);
        }
      } else {
        // No previous element - must be the first children
        targetForChildren.prepend(...elementsToAdd);
      }
    }
  }

  private handleChildrenRemoved(message: NetworkedDOMV02ChildrenRemovedDiff) {
    const { nodeId, removedNodes } = message;
    if (nodeId === undefined || nodeId === null) {
      console.warn("No nodeId in childrenChanged message");
      return;
    }
    const parent = this.idToElement.get(nodeId);
    if (!parent) {
      throw new Error("No parent found for childrenChanged message");
    }
    if (!isHTMLElement(parent, this.parentElement)) {
      throw new Error("Parent is not an HTMLElement (that supports children)");
    }

    for (const removedNode of removedNodes) {
      const childElement = this.idToElement.get(removedNode);
      if (!childElement) {
        throw new Error(`Child element not found: ${removedNode}`);
      }
      this.elementToId.delete(childElement);
      this.idToElement.delete(removedNode);

      const targetForRemoval = getRemovalTarget(parent);

      const hiddenElement = this.hiddenPlaceholderElements.get(removedNode);
      if (hiddenElement) {
        // This element was hidden so we remove the placeholder from the parent
        const placeholder = hiddenElement.placeholder;
        try {
          targetForRemoval.removeChild(placeholder);
        } catch (e) {
          console.error("error removing placeholder child", e);
        }
        this.hiddenPlaceholderElements.delete(removedNode);
        this.placeholderToId.delete(placeholder);
        if (isHTMLElement(childElement, this.parentElement)) {
          // If child is capable of supporting children then remove any that exist
          this.removeChildElementIds(childElement);
        }
      } else {
        try {
          targetForRemoval.removeChild(childElement);
        } catch (e) {
          console.error("error removing child", e);
        }
        if (isHTMLElement(childElement, this.parentElement)) {
          // If child is capable of supporting children then remove any that exist
          this.removeChildElementIds(childElement);
        }
      }
    }
  }

  private removeChildElementIds(parent: HTMLElement) {
    // If portal element, remove from portal element
    const portal = getChildrenTarget(parent);
    if (portal !== parent) {
      this.removeChildElementIds(portal as HTMLElement);
    }
    const childNodes = parent.childNodes;
    for (let i = 0; i < childNodes.length; i++) {
      const child = childNodes[i];
      const childId = this.elementToId.get(child as HTMLElement);
      if (!childId) {
        const placeholderId = this.placeholderToId.get(child);
        if (placeholderId) {
          const childElement = this.idToElement.get(placeholderId);
          if (childElement) {
            this.elementToId.delete(childElement);
          } else {
            console.error(
              "Inner child of removed placeholder element not found by id",
              placeholderId,
            );
          }
          this.idToElement.delete(placeholderId);
          this.placeholderToId.delete(child);
          this.hiddenPlaceholderElements.delete(placeholderId);
          this.removeChildElementIds(childElement as HTMLElement);
        } else {
          console.error(
            "Inner child of removed element had no id",
            (child as HTMLElement).outerHTML,
          );
        }
      } else {
        this.elementToId.delete(child);
        this.idToElement.delete(childId);
        this.removeChildElementIds(child as HTMLElement);
      }
    }
  }

  private handleSnapshot(message: NetworkedDOMV02SnapshotMessage) {
    // This websocket is successfully connected. Reset the backoff time.
    if (this.currentRoot) {
      this.currentRoot.remove();
      this.currentRoot = null;
      this.elementToId.clear();
      this.idToElement.clear();
    }

    this.timeCallback?.(message.documentTime);

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

  private handleDocumentTime(message: NetworkedDOMV02DocumentTimeMessage) {
    this.timeCallback?.(message.documentTime);
  }

  private handleAttributeChange(message: NetworkedDOMV02AttributesChangedDiff) {
    const { nodeId, attributes } = message;
    if (nodeId === undefined || nodeId === null) {
      console.warn("No nodeId in attributeChange message");
      return;
    }
    let element = this.idToElement.get(nodeId);
    const hiddenElement = this.hiddenPlaceholderElements.get(nodeId);
    if (hiddenElement) {
      // This element is hidden - apply the attributes to the hidden element
      element = hiddenElement.element;
    }
    if (element) {
      if (isHTMLElement(element, this.parentElement)) {
        for (const [key, newValue] of attributes) {
          if (newValue === null) {
            element.removeAttribute(key);
          } else {
            setElementAttribute(element, key, newValue);
          }
        }
      } else {
        console.error("Element is not an HTMLElement and cannot support attributes", element);
      }
    } else {
      console.error("No element found for attributeChange message");
    }
  }

  private handleNewElement(message: NetworkedDOMV02NodeDescription): Node | null {
    if (message.type === "text") {
      const { nodeId, text } = message;
      const textNode = document.createTextNode("");
      textNode.textContent = text;
      this.idToElement.set(nodeId, textNode);
      this.elementToId.set(textNode, nodeId);
      return textNode;
    }
    const { tag, nodeId, attributes, children, text, hiddenFrom } = message;
    if (this.idToElement.has(nodeId)) {
      console.error(
        "Received nodeId to add that is already present",
        nodeId,
        this.idToElement.get(nodeId),
      );
      throw new Error("Received nodeId to add that is already present: " + nodeId);
    }

    if (tag === "#text") {
      const textNode = document.createTextNode("");
      textNode.textContent = text || null;
      this.idToElement.set(nodeId, textNode);
      this.elementToId.set(textNode, nodeId);
      return textNode;
    }

    let element: Element;
    try {
      element = createElementWithSVGSupport(tag, this.options);
    } catch (e) {
      console.error(`Error creating element: (${tag})`, e);
      element = document.createElement("x-div");
    }
    for (const [key, value] of attributes) {
      if (value !== null) {
        setElementAttribute(element, key, value);
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

    if (hiddenFrom && hiddenFrom.length > 0 && hiddenFrom.indexOf(connectionId) !== -1) {
      // This element is hidden - create a placeholder that will be in the DOM to maintain structure, but keep the underlying element hidden
      const placeholder = document.createElement(hiddenTag);
      this.hiddenPlaceholderElements.set(nodeId, { placeholder, element });
      this.placeholderToId.set(placeholder, nodeId);

      // The actual element is not added to the DOM, but it is stored for when it is unhidden (and should be the target for attribute changes, children additions, etc.)
      this.idToElement.set(nodeId, element);
      this.elementToId.set(element, nodeId);

      return placeholder;
    } else {
      this.idToElement.set(nodeId, element);
      this.elementToId.set(element, nodeId);
      return element;
    }
  }

  private handlePing(message: NetworkedDOMV02PingMessage) {
    this.timeCallback?.(message.documentTime);
    this.send({
      type: "pong",
      pong: message.ping,
    });
  }
}
