import { VIRTUAL_ELEMENT_BRAND } from "../virtual-dom";
import { VirtualHTMLElement } from "../virtual-dom";
import { VirtualNode } from "../virtual-dom";

/**
 * Asserts that an element is a real DOM HTMLElement and returns it with the correct type.
 * Throws if called with a virtual element — callers must guard against virtual mode
 * before calling this function (e.g. check `documentFactory` or `VIRTUAL_DOCUMENT_BRAND`).
 */
export function asHTMLElement(element: VirtualHTMLElement): HTMLElement {
  if (typeof HTMLElement !== "undefined" && element instanceof HTMLElement) {
    return element;
  }
  if (element[VIRTUAL_ELEMENT_BRAND] === true) {
    throw new Error("asHTMLElement called on a virtual element. This operation requires DOM mode.");
  }
  // After overwriteSuperclass, elements created in a different window/iframe
  // may fail the current window's instanceof check. Try the element's own
  // window context via ownerDocument.defaultView.
  const ownerDoc = (
    element as unknown as {
      ownerDocument?: { defaultView?: (Window & { HTMLElement?: typeof HTMLElement }) | null };
    }
  ).ownerDocument;
  if (ownerDoc?.defaultView) {
    const FrameHTMLElement = ownerDoc.defaultView.HTMLElement;
    if (FrameHTMLElement && element instanceof FrameHTMLElement) {
      return element as unknown as HTMLElement;
    }
  }
  throw new Error(
    "asHTMLElement: element is neither an HTMLElement nor a virtual element. " +
      "Ensure the element was created in the correct context.",
  );
}

/**
 * Asserts that a node is a real DOM Node and returns it with the correct type.
 * Throws if called with a virtual node — callers must guard against virtual mode
 * before calling this function.
 */
export function asNode(node: VirtualNode): Node {
  if (typeof Node !== "undefined" && node instanceof Node) {
    return node;
  }
  if ((node as VirtualHTMLElement)[VIRTUAL_ELEMENT_BRAND] === true) {
    throw new Error("asNode called on a virtual node. This operation requires DOM mode.");
  }
  // Try cross-frame check via ownerDocument.defaultView
  const ownerDoc = (node as unknown as { ownerDocument?: { defaultView?: Window | null } })
    .ownerDocument;
  if (ownerDoc?.defaultView) {
    const FrameNode = (ownerDoc.defaultView as unknown as { Node?: typeof Node }).Node;
    if (FrameNode && node instanceof FrameNode) {
      return node as unknown as Node;
    }
  }
  throw new Error(
    "asNode: node is neither a Node nor a virtual element. " +
      "Ensure the node was created in the correct context.",
  );
}
