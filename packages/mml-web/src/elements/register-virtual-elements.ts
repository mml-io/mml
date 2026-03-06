import { VirtualDocument } from "../virtual-dom";
import { MML_ELEMENTS } from "./mml-element-list";

export function registerCustomElementsToVirtualDocument(doc: VirtualDocument): void {
  for (const Element of MML_ELEMENTS) {
    doc.registerElement(Element.tagName, Element);
  }
}
