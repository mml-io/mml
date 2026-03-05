/**
 * Well-known symbols used to identify virtual DOM nodes without instanceof checks.
 * Using Symbol.for() ensures the same symbol is used across packages and module boundaries.
 *
 * These are defined here (in networked-dom-web) so that both this package and
 * higher-level packages (mml-web) share a single source of truth.
 */
export const VIRTUAL_ELEMENT_BRAND = Symbol.for("mml-virtual-element");
export const VIRTUAL_TEXT_BRAND = Symbol.for("mml-virtual-text");
export const VIRTUAL_DOCUMENT_BRAND = Symbol.for("mml-virtual-document");
export const VIRTUAL_FRAGMENT_BRAND = Symbol.for("mml-virtual-fragment");

/**
 * Minimal node interface covering the DOM methods used by networked-dom-web.
 *
 * Properties like `parentNode`, `ownerDocument`, and method parameters use `any`
 * intentionally so that `INodeLike` remains structurally compatible with the real
 * DOM's `Node` type (where e.g. `parentNode` is `ParentNode | null`, not `INodeLike`).
 */
export interface INodeLike {
  readonly [VIRTUAL_ELEMENT_BRAND]?: true;
  readonly [VIRTUAL_TEXT_BRAND]?: true;
  readonly [VIRTUAL_FRAGMENT_BRAND]?: true;
  nodeName: string;
  textContent: string | null;

  readonly parentNode: any;
  readonly childNodes: ArrayLike<INodeLike>;
  readonly firstChild: INodeLike | null;
  readonly nextSibling: INodeLike | null;

  readonly ownerDocument: any;

  appendChild(child: any): any;

  insertBefore(newChild: any, refChild: any): any;

  removeChild(child: any): any;

  replaceChild(newChild: any, oldChild: any): any;
  remove(): void;
}

export interface IStyleLike {
  [key: string]: any;
  setProperty?(name: string, value: string | null): void;
  getPropertyValue?(name: string): string;
  removeProperty?(name: string): string;
}

export interface IElementLike extends INodeLike {
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  removeAttribute(name: string): void;
  getAttributeNames(): string[];
  hasAttribute(name: string): boolean;
  attributes: ArrayLike<{ name: string; value: string }>;
  style: IStyleLike;
  innerHTML: string;
  outerHTML: string;

  readonly parentElement: any;

  addEventListener(type: string, listener: (event: any) => void): void;

  removeEventListener(type: string, listener: (event: any) => void): void;

  dispatchEvent(event: any): boolean;

  append(...nodes: any[]): void;

  prepend(...nodes: any[]): void;
}

/**
 * Elements that support portal-based child delegation (e.g. Overlay).
 */
export interface IPortalElement extends IElementLike {
  getPortalElement(): IElementLike;
  getPortalDocumentFactory?(): IDocumentFactory | null;
}

export interface IDocumentFactory {
  createElement(tagName: string): IElementLike;
  createElementNS?(namespace: string, tagName: string): IElementLike;
  createTextNode(text: string): INodeLike;

  createDocumentFragment(): any;
}

/**
 * Type guard to check if a node is an element (has setAttribute).
 * Works for both real DOM Elements and VirtualHTMLElements.
 */
export function isElementLike(node: INodeLike): node is IElementLike {
  return typeof (node as IElementLike).setAttribute === "function";
}

/**
 * Type guard to check if an element supports portal-based child delegation.
 */
export function isPortalElement(element: IElementLike): element is IPortalElement {
  return typeof (element as IPortalElement).getPortalElement === "function";
}
