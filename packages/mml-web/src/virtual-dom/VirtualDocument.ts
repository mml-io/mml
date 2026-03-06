import { VIRTUAL_DOCUMENT_BRAND } from "./brands";
import { VirtualDocumentFragment } from "./VirtualDocumentFragment";
import { VirtualHTMLElement } from "./VirtualHTMLElement";
import { VirtualTextNode } from "./VirtualTextNode";

export class VirtualDocument {
  readonly [VIRTUAL_DOCUMENT_BRAND] = true as const;
  private registry = new Map<string, new () => VirtualHTMLElement>();
  public defaultView: null = null;

  registerElement(tagName: string, constructor: new () => VirtualHTMLElement): void {
    this.registry.set(tagName.toLowerCase(), constructor);
  }

  createElement(tagName: string): VirtualHTMLElement {
    return this._createElementInternal(tagName);
  }

  createElementNS(namespace: string, tagName: string): VirtualHTMLElement {
    if (namespace && namespace !== "http://www.w3.org/1999/xhtml") {
      console.warn(
        `VirtualDocument.createElementNS: namespace "${namespace}" is not supported; treating as plain element.`,
      );
    }
    return this._createElementInternal(tagName);
  }

  private _createElementInternal(tagName: string): VirtualHTMLElement {
    const normalizedTag = tagName.toLowerCase();
    const Ctor = this.registry.get(normalizedTag);
    let element: VirtualHTMLElement;
    if (Ctor) {
      element = new Ctor();
    } else {
      element = new VirtualHTMLElement();
      element.nodeName = tagName.toUpperCase();
    }
    element.ownerDocument = this;
    return element;
  }

  createTextNode(text: string): VirtualTextNode {
    const node = new VirtualTextNode(text);
    node.ownerDocument = this;
    return node;
  }

  createDocumentFragment(): VirtualDocumentFragment {
    const frag = new VirtualDocumentFragment();
    frag.ownerDocument = this;
    return frag;
  }
}
