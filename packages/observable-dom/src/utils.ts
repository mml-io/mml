import { StaticVirtualDOMElement } from "@mml-io/observable-dom-common";

import { LiveVirtualDOMElement } from "./ObservableDOM";

export function virtualDOMElementToStatic(el: LiveVirtualDOMElement): StaticVirtualDOMElement {
  return {
    nodeId: el.nodeId,
    tag: el.tag,
    attributes: el.attributes,
    childNodes: el.childNodes.map((child) => virtualDOMElementToStatic(child)),
    textContent: el.textContent,
  };
}
