import { VIRTUAL_FRAGMENT_BRAND } from "./brands";
import { VirtualDocumentFragment } from "./VirtualDocumentFragment";

/**
 * Minimal document interface covering the methods used internally by VirtualNode.
 * Using a local interface avoids structural incompatibilities between the real DOM
 * `Document` type and `IDocumentFactory` while still providing meaningful type safety.
 */
export interface VirtualNodeOwnerDocument {
  createElement(tagName: string): unknown;
  createTextNode(text: string): unknown;
  createDocumentFragment(): unknown;
  defaultView?: Window | null;
}

/**
 * Interface for VirtualNode subclasses that support custom element lifecycle callbacks.
 * Declared here so VirtualNode can call them without circular imports.
 */
export interface VirtualLifecycleCallbacks {
  connectedCallback?(): void;
  disconnectedCallback?(): void;
  attributeChangedCallback?(name: string, oldValue: string | null, newValue: string | null): void;
}

/**
 * Interface for VirtualHTMLElement constructor statics.
 */
export interface VirtualElementConstructor {
  tagName?: string;
  observedAttributes?: string[];
}

// Injected factory to create text nodes without circular imports.
// Set by VirtualTextNode's module initialization via registerTextNodeFactory().
let textNodeFactory: ((text: string) => VirtualNode) | null = null;

/**
 * Registers the factory function used to create VirtualTextNode instances.
 * Called by VirtualTextNode module initialization to break the circular dependency
 * between VirtualNode and VirtualTextNode.
 */
export function registerTextNodeFactory(factory: (text: string) => VirtualNode): void {
  textNodeFactory = factory;
}

export class VirtualNode {
  public nodeName: string;
  public ownerDocument: VirtualNodeOwnerDocument | null = null;
  private _parentNode: VirtualNode | null = null;
  private _childNodes: VirtualNode[] = [];
  private _isConnected = false;
  private _rootConnected = false;

  constructor(nodeName: string = "") {
    this.nodeName = nodeName;
  }

  get parentNode(): VirtualNode | null {
    return this._parentNode;
  }

  get parentElement(): VirtualNode | null {
    // Only return the parent if it is an element node (has setAttribute),
    // not a document fragment or plain VirtualNode. Uses duck-typing to
    // avoid circular import with VirtualHTMLElement.
    if (
      this._parentNode &&
      typeof (this._parentNode as unknown as VirtualLifecycleCallbacks).attributeChangedCallback ===
        "function"
    ) {
      return this._parentNode;
    }
    return null;
  }

  get childNodes(): VirtualNode[] & { forEach: Array<VirtualNode>["forEach"] } {
    return this._childNodes;
  }

  get nextSibling(): VirtualNode | null {
    if (!this._parentNode) return null;
    const siblings = this._parentNode._childNodes;
    const index = siblings.indexOf(this);
    return index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;
  }

  get previousSibling(): VirtualNode | null {
    if (!this._parentNode) return null;
    const siblings = this._parentNode._childNodes;
    const index = siblings.indexOf(this);
    return index > 0 ? siblings[index - 1] : null;
  }

  get firstChild(): VirtualNode | null {
    return this._childNodes.length > 0 ? this._childNodes[0] : null;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get textContent(): string | null {
    return this._childNodes.map((child) => child.textContent ?? "").join("");
  }

  set textContent(value: string | null) {
    // Remove all children (mirrors real DOM behavior)
    while (this._childNodes.length > 0) {
      this.removeChild(this._childNodes[this._childNodes.length - 1]);
    }
    // Create a text node child if the value is non-empty (mirrors real DOM behavior)
    if (value !== null && value !== "") {
      // Prefer ownerDocument.createTextNode (available on most attached nodes) to avoid
      // depending on the textNodeFactory registration order. Fall back to the factory for
      // unattached nodes, and throw a clear error if neither is available.
      let textNode: VirtualNode;
      if (this.ownerDocument && typeof this.ownerDocument.createTextNode === "function") {
        textNode = this.ownerDocument.createTextNode(value) as unknown as VirtualNode;
      } else if (textNodeFactory) {
        textNode = textNodeFactory(value);
      } else {
        throw new Error(
          "VirtualNode text node factory not registered and no ownerDocument available. " +
            "Ensure VirtualTextNode module is imported or the node is attached to a VirtualDocument.",
        );
      }
      this.appendChild(textNode);
    }
  }

  /**
   * Marks this node as a connected root (like document body or remote document root).
   * When set to true, this node and all its descendants become "connected".
   */
  public setRootConnected(connected: boolean): void {
    this._rootConnected = connected;
    this._updateConnected(connected);
  }

  private _isAncestorConnected(): boolean {
    if (this._rootConnected) return true;
    if (this._parentNode) return this._parentNode._isAncestorConnected();
    return false;
  }

  private _updateConnected(connected: boolean): void {
    const wasConnected = this._isConnected;
    this._isConnected = connected;
    const lifecycle = this as unknown as VirtualLifecycleCallbacks;
    if (connected && !wasConnected) {
      if (typeof lifecycle.connectedCallback === "function") {
        lifecycle.connectedCallback();
      }
    } else if (!connected && wasConnected) {
      if (typeof lifecycle.disconnectedCallback === "function") {
        lifecycle.disconnectedCallback();
      }
    }
    for (const child of this._childNodes) {
      child._updateConnected(connected);
    }
  }

  private _adoptChild(child: VirtualNode): void {
    // Remove from previous parent
    if (child._parentNode) {
      // If the child was connected, trigger disconnect first (mirrors DOM behavior
      // where moving a node fires disconnectedCallback then connectedCallback)
      if (child._isConnected) {
        child._updateConnected(false);
      }
      child._parentNode._removeChildInternal(child);
    }
    child._parentNode = this;
    if (child.ownerDocument === null && this.ownerDocument !== null) {
      VirtualNode._propagateOwnerDocument(child, this.ownerDocument);
    }
  }

  private static _propagateOwnerDocument(node: VirtualNode, doc: VirtualNodeOwnerDocument): void {
    node.ownerDocument = doc;
    for (const child of node._childNodes) {
      if (child.ownerDocument === null) {
        VirtualNode._propagateOwnerDocument(child, doc);
      }
    }
  }

  private _removeChildInternal(child: VirtualNode): void {
    const index = this._childNodes.indexOf(child);
    if (index !== -1) {
      this._childNodes.splice(index, 1);
    }
  }

  private static _isFragment(node: VirtualNode): node is VirtualDocumentFragment {
    return (node as VirtualDocumentFragment)[VIRTUAL_FRAGMENT_BRAND] === true;
  }

  append(...nodes: VirtualNode[]): void {
    for (const node of nodes) {
      this.appendChild(node);
    }
  }

  prepend(...nodes: VirtualNode[]): void {
    const firstChild = this._childNodes[0] || null;
    for (const node of nodes) {
      if (firstChild) {
        this.insertBefore(node, firstChild);
      } else {
        this.appendChild(node);
      }
    }
  }

  appendChild(child: VirtualNode): VirtualNode {
    if (VirtualNode._isFragment(child)) {
      const fragmentChildren = [...child._childNodes];
      for (const fragChild of fragmentChildren) {
        this.appendChild(fragChild);
      }
      return child;
    }
    this._adoptChild(child);
    this._childNodes.push(child);
    if (this._isAncestorConnected()) {
      child._updateConnected(true);
    }
    return child;
  }

  insertBefore(newNode: VirtualNode, referenceNode: VirtualNode | null): VirtualNode {
    if (referenceNode === null) {
      return this.appendChild(newNode);
    }
    if (VirtualNode._isFragment(newNode)) {
      const fragmentChildren = [...newNode._childNodes];
      for (const fragChild of fragmentChildren) {
        this.insertBefore(fragChild, referenceNode);
      }
      return newNode;
    }
    this._adoptChild(newNode);
    // Recompute index after _adoptChild, which may have removed newNode from this parent
    const index = this._childNodes.indexOf(referenceNode);
    if (index === -1) {
      throw new Error("Reference node not found in parent's children");
    }
    this._childNodes.splice(index, 0, newNode);
    if (this._isAncestorConnected()) {
      newNode._updateConnected(true);
    }
    return newNode;
  }

  removeChild(child: VirtualNode): VirtualNode {
    const index = this._childNodes.indexOf(child);
    if (index === -1) {
      throw new Error("Node not found in parent's children");
    }
    if (child._isConnected) {
      child._updateConnected(false);
    }
    this._childNodes.splice(index, 1);
    child._parentNode = null;
    return child;
  }

  replaceChild(newChild: VirtualNode, oldChild: VirtualNode): VirtualNode {
    if (newChild === oldChild) {
      // No-op: replacing a node with itself (matches real DOM behavior)
      return oldChild;
    }
    const index = this._childNodes.indexOf(oldChild);
    if (index === -1) {
      throw new Error("Old node not found in parent's children");
    }
    if (oldChild._isConnected) {
      oldChild._updateConnected(false);
    }
    this._adoptChild(newChild);
    // Recompute index after _adoptChild, which may have shifted the array
    const newIndex = this._childNodes.indexOf(oldChild);
    if (newIndex === -1) {
      // oldChild was already removed by _adoptChild (should not happen now that
      // the identity case is handled above, but kept as a safety net)
      this._childNodes.splice(index, 0, newChild);
    } else {
      this._childNodes[newIndex] = newChild;
    }
    oldChild._parentNode = null;
    if (this._isAncestorConnected()) {
      newChild._updateConnected(true);
    }
    return oldChild;
  }

  remove(): void {
    if (this._parentNode) {
      this._parentNode.removeChild(this);
    }
  }
}
