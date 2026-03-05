import { IDocumentFactory, IElementLike, INodeLike, isElementLike } from "./DocumentInterface";
import { getChildrenTarget } from "./ElementUtils";
import {
  isHTMLElement,
  NetworkedDOMWebsocketAdapter,
  NetworkedDOMWebsocketOptions,
} from "./NetworkedDOMWebsocket";
import { flushPendingPortalChildren } from "./PortalUtils";

/**
 * Shared state and element management logic for both V01 and V02 websocket adapters.
 *
 * Subclasses handle protocol-specific concerns: message encoding/decoding, event
 * format, hidden element placeholders (V02), and batch mode (V02).
 */
export abstract class NetworkedDOMWebsocketAdapterBase implements NetworkedDOMWebsocketAdapter {
  protected idToElement = new Map<number, INodeLike>();
  protected elementToId = new Map<INodeLike, number>();
  protected currentRoot: INodeLike | null = null;
  protected readonly docFactory: IDocumentFactory;
  protected pendingPortalChildren = new Map<IElementLike, INodeLike[]>();
  protected elementFactoryOverride = new Map<INodeLike, IDocumentFactory>();

  constructor(
    protected readonly websocket: WebSocket,
    protected readonly parentElement: IElementLike,
    protected readonly connectedCallback: () => void,
    protected readonly timeCallback?: (time: number) => void,
    protected readonly options: NetworkedDOMWebsocketOptions = {},
    doc?: IDocumentFactory,
  ) {
    this.websocket.binaryType = "arraybuffer";
    if (!doc && typeof document === "undefined") {
      throw new Error(
        "NetworkedDOMWebsocketAdapter requires a document factory (IDocumentFactory) in non-browser environments",
      );
    }
    this.docFactory = doc ?? document;
  }

  abstract receiveMessage(event: MessageEvent): void;
  abstract handleEvent(element: IElementLike, event: CustomEvent): void;

  public clearContents(): boolean {
    this.idToElement.clear();
    this.elementToId.clear();
    this.elementFactoryOverride.clear();
    this.pendingPortalChildren.clear();
    if (this.currentRoot) {
      this.currentRoot.remove();
      this.currentRoot = null;
      return true;
    }
    return false;
  }

  /**
   * Creates a text node, registers it in the id maps, and returns it.
   */
  protected createTextNode(nodeId: number, text: string, factory: IDocumentFactory): INodeLike {
    const textNode = factory.createTextNode("");
    textNode.textContent = text;
    this.idToElement.set(nodeId, textNode);
    this.elementToId.set(textNode, nodeId);
    return textNode;
  }

  /**
   * Inserts elements into the correct position within a parent, using
   * previousElement/nextElement for positioning. Creates a DocumentFragment
   * when inserting before a reference node.
   */
  protected insertElements(
    targetForChildren: IElementLike,
    elementsToAdd: INodeLike[],
    previousElement: INodeLike | null,
    nextElement: INodeLike | null,
    factory: IDocumentFactory,
  ): void {
    if (elementsToAdd.length === 0) return;
    if (previousElement) {
      if (nextElement) {
        // There is a previous and next element - insertBefore the next element
        const docFrag = factory.createDocumentFragment();
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

  /**
   * Recursively removes element-to-id mappings for all descendants of a parent.
   * V02 overrides this to also handle hidden placeholder elements.
   */
  protected removeChildElementIds(parent: INodeLike): void {
    if (isElementLike(parent)) {
      const portal = getChildrenTarget(parent);
      if (portal !== parent) {
        this.removeChildElementIds(portal);
      }
    }
    for (let i = 0; i < parent.childNodes.length; i++) {
      const child = parent.childNodes[i];
      const childId = this.elementToId.get(child);
      if (!childId) {
        this.handleUnregisteredChild(child);
      } else {
        this.elementToId.delete(child);
        this.idToElement.delete(childId);
        this.elementFactoryOverride.delete(child);
      }
      this.removeChildElementIds(child);
    }
  }

  /**
   * Called during removeChildElementIds when a child has no registered id.
   * V01 logs an error. V02 overrides to check for placeholder elements.
   */
  protected handleUnregisteredChild(child: INodeLike): void {
    console.error("Inner child of removed element had no id", child);
  }

  /**
   * Resets state and applies a snapshot element to the parent.
   * Appending to the tree triggers MElement connectedCallbacks (which set up portals),
   * then pending portal children are flushed.
   */
  protected resetAndApplySnapshot(element: INodeLike): void {
    if (this.currentRoot) {
      this.removeChildElementIds(this.currentRoot);
      const rootId = this.elementToId.get(this.currentRoot);
      if (rootId !== undefined) {
        this.elementToId.delete(this.currentRoot);
        this.idToElement.delete(rootId);
        this.elementFactoryOverride.delete(this.currentRoot);
      }
      this.currentRoot.remove();
      this.currentRoot = null;
      this.pendingPortalChildren.clear();
    }

    if (!isHTMLElement(element, this.parentElement)) {
      throw new Error("Snapshot element is not an HTMLElement");
    }
    this.currentRoot = element;
    this.parentElement.append(element);
    flushPendingPortalChildren(this.pendingPortalChildren);
  }
}
