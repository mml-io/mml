import { StaticVirtualDomElement } from "@mml-io/observable-dom-common";

import { LiveVirtualDomElement } from "./ObservableDom";

export function virtualDomElementToStatic(el: LiveVirtualDomElement): StaticVirtualDomElement {
  return {
    nodeId: el.nodeId,
    tag: el.tag,
    attributes: el.attributes,
    childNodes: el.childNodes.map((child) => virtualDomElementToStatic(child)),
    textContent: el.textContent,
  };
}
