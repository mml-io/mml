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

// This client uses a single connection id
const connectionId = 1;

// If an element should not be visible to this client, it will be replaced with this tag and attributes will be stored ready to be applied if it is unhidden.
const hiddenTag = "x-hidden";

export class NetworkedDOMWebsocketV02Adapter extends NetworkedDOMWebsocketAdapterBase {
  private placeholderToId = new Map<INodeLike, number>();
  private hiddenPlaceholderElements = new Map<
    number,
    {
      placeholder: IElementLike;
      element: IElementLike;
    }
  >();
  private batchMode = false;
  private batchMessages: Array<NetworkedDOMV02ServerMessage> = [];
  private readonly protocolSubversion: networkedDOMProtocolSubProtocol_v0_2_SubversionNumber;

  constructor(
    websocket: WebSocket,
    parentElement: IElementLike,
    connectedCallback: () => void,
    timeCallback?: (time: number) => void,
    options: NetworkedDOMWebsocketOptions = {},
    doc?: IDocumentFactory,
  ) {
    super(websocket, parentElement, connectedCallback, timeCallback, options, doc);
    this.protocolSubversion = getNetworkedDOMProtocolSubProtocol_v0_2SubversionOrThrow(
      websocket.protocol as networkedDOMProtocolSubProtocol_v0_2_Subversion,
    );
    this.send({
      type: "connectUsers",
      connectionIds: [connectionId],
      connectionTokens: [this.options.connectionToken ?? null],
    });
  }

  public handleEvent(element: IElementLike, event: CustomEvent) {
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
    this.placeholderToId.clear();
    this.hiddenPlaceholderElements.clear();
    this.batchMessages = [];
    this.batchMode = false;
    return super.clearContents();
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
      const element = node as IElementLike;
      const parent = element.parentElement;
      if (!parent) {
        throw new Error("Node has no parent");
      }
      const placeholder = this.docFactory.createElement(hiddenTag);
      parent.replaceChild(placeholder, element);
      this.hiddenPlaceholderElements.set(nodeId, { placeholder, element });
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
    let parentNode = this.idToElement.get(nodeId);
    if (!parentNode) {
      throw new Error("No parent found for childrenChanged message");
    }

    const hiddenParent = this.hiddenPlaceholderElements.get(nodeId);
    if (hiddenParent) {
      // This element is hidden - add the children to the hidden element (not the placeholder)
      parentNode = hiddenParent.element;
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
  }

  private handleChildrenRemoved(message: NetworkedDOMV02ChildrenRemovedDiff) {
    const { nodeId, removedNodes } = message;
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

    for (const removedNode of removedNodes) {
      const childElement = this.idToElement.get(removedNode);
      if (!childElement) {
        throw new Error(`Child element not found: ${removedNode}`);
      }
      this.elementToId.delete(childElement);
      this.idToElement.delete(removedNode);

      const targetForRemoval = getRemovalTarget(parentNode);

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

  protected override handleUnregisteredChild(child: INodeLike): void {
    const placeholderId = this.placeholderToId.get(child);
    if (placeholderId) {
      const childElement = this.idToElement.get(placeholderId);
      if (childElement) {
        this.elementToId.delete(childElement);
      } else {
        console.error("Inner child of removed placeholder element not found by id", placeholderId);
      }
      this.idToElement.delete(placeholderId);
      this.placeholderToId.delete(child);
      this.hiddenPlaceholderElements.delete(placeholderId);
      if (childElement) {
        this.removeChildElementIds(childElement);
      }
    } else {
      console.error(
        "Inner child of removed element had no id",
        (child as IElementLike)?.outerHTML ?? child,
      );
    }
  }

  private handleSnapshot(message: NetworkedDOMV02SnapshotMessage) {
    this.timeCallback?.(message.documentTime);
    const element = this.handleNewElement(message.snapshot);
    if (!element) {
      throw new Error("Snapshot element not created");
    }
    this.resetAndApplySnapshot(element);
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
    let node: INodeLike | IElementLike | undefined = this.idToElement.get(nodeId);
    const hiddenElement = this.hiddenPlaceholderElements.get(nodeId);
    if (hiddenElement) {
      // This element is hidden - apply the attributes to the hidden element
      node = hiddenElement.element;
    }
    if (node) {
      if (isHTMLElement(node, this.parentElement)) {
        for (const [key, newValue] of attributes) {
          if (newValue === null) {
            node.removeAttribute(key);
          } else {
            setElementAttribute(node, key, newValue);
          }
        }
      } else {
        console.error("Element is not an HTMLElement and cannot support attributes", node);
      }
    } else {
      console.error("No element found for attributeChange message");
    }
  }

  private handleNewElement(
    message: NetworkedDOMV02NodeDescription,
    factoryOverride?: IDocumentFactory,
  ): INodeLike | null {
    const factory = factoryOverride ?? this.docFactory;

    if (message.type === "text") {
      return this.createTextNode(message.nodeId, message.text, factory);
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
      return this.createTextNode(nodeId, text || "", factory);
    }

    let element: IElementLike;
    try {
      element = createElementWithSVGSupport(tag, this.options, factory);
    } catch (e) {
      console.error(`Error creating element: (${tag})`, e);
      element = factory.createElement("x-div");
    }
    for (const [key, value] of attributes) {
      if (value !== null) {
        setElementAttribute(element, key, value);
      }
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

    if (hiddenFrom && hiddenFrom.length > 0 && hiddenFrom.indexOf(connectionId) !== -1) {
      // This element is hidden - create a placeholder that will be in the DOM to maintain structure, but keep the underlying element hidden
      const placeholder = this.docFactory.createElement(hiddenTag);
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
