import {
  NetworkedDOMV01ElementNodeDescription,
  NetworkedDOMV01NodeDescription,
  NetworkedDOMV02ElementNodeDescription,
  NetworkedDOMV02NodeDescription,
  NetworkedDOMV02TextNodeDescription,
} from "@mml-io/networked-dom-protocol";

import { NetworkedDOMV01Connection } from "../NetworkedDOMV01Connection";
import { NetworkedDOMV02Connection } from "../NetworkedDOMV02Connection";
import {
  IsVisibleToAll,
  IsVisibleToAnyOneOfConnectionIds,
  NodeWithSubjectivity,
} from "../NodeWithSubjectivity";

export const visibleToAttrName = "visible-to";
export const hiddenFromAttrName = "hidden-from";

function filteredV01Attributes(
  attributes: { [key: string]: string },
  excludedKeys: Set<string>,
): { [key: string]: string } {
  const filtered: { [key: string]: string } = {};
  for (const key in attributes) {
    if (!excludedKeys.has(key)) {
      filtered[key] = attributes[key];
    }
  }
  return filtered;
}

function filteredV02Attributes(
  attributes: { [key: string]: string },
  excludedKeys: Set<string>,
): Array<[string, string]> {
  const filtered: Array<[string, string]> = [];
  for (const key in attributes) {
    if (!excludedKeys.has(key)) {
      filtered.push([key, attributes[key]]);
    }
  }
  return filtered;
}

const excludedAttributes = new Set([visibleToAttrName, hiddenFromAttrName]);

export function describeNodeWithChildrenForV01Connection(
  virtualDOMElement: NodeWithSubjectivity,
  networkedDOMConnection: NetworkedDOMV01Connection | null,
): NetworkedDOMV01NodeDescription | null {
  if (
    networkedDOMConnection
      ? !IsVisibleToAnyOneOfConnectionIds(
          virtualDOMElement.subjectivity,
          networkedDOMConnection.internalIdToExternalId,
          true,
        )
      : !IsVisibleToAll(virtualDOMElement.subjectivity, true)
  ) {
    return null;
  }
  let emittedTagName = virtualDOMElement.tag;
  if (emittedTagName === "#DOCUMENT") {
    emittedTagName = "DIV";
  }
  if (emittedTagName === "#text") {
    const textNode: NetworkedDOMV02TextNodeDescription = {
      type: "text",
      nodeId: virtualDOMElement.nodeId,
      text: virtualDOMElement.textContent || "",
    };
    return textNode;
  } else {
    const node: NetworkedDOMV01ElementNodeDescription = {
      type: "element",
      nodeId: virtualDOMElement.nodeId,
      tag: emittedTagName,
      attributes: filteredV01Attributes(virtualDOMElement.attributes, excludedAttributes),
      children: [],
      text: virtualDOMElement.textContent,
    };

    for (const child of virtualDOMElement.childNodes) {
      const childNodeDescription = describeNodeWithChildrenForV01Connection(
        child,
        networkedDOMConnection,
      );
      if (childNodeDescription) {
        node.children.push(childNodeDescription);
      }
    }
    return node;
  }
}

export function describeNodeWithChildrenForV02Connection(
  virtualDOMElement: NodeWithSubjectivity,
  networkedDOMConnection: NetworkedDOMV02Connection | null,
): NetworkedDOMV02NodeDescription | null {
  if (
    networkedDOMConnection
      ? !IsVisibleToAnyOneOfConnectionIds(
          virtualDOMElement.subjectivity,
          networkedDOMConnection.internalIdToExternalId,
          false,
        )
      : !IsVisibleToAll(virtualDOMElement.subjectivity, false)
  ) {
    return null;
  }
  let emittedTagName = virtualDOMElement.tag;
  if (emittedTagName === "#DOCUMENT") {
    emittedTagName = "DIV";
  }
  if (emittedTagName === "#text") {
    const textNode: NetworkedDOMV02TextNodeDescription = {
      type: "text",
      nodeId: virtualDOMElement.nodeId,
      text: virtualDOMElement.textContent || "",
    };
    return textNode;
  } else {
    const visibleTo: Array<number> = [];
    const hiddenFrom: Array<number> = [];
    const hasOwnSubjectivity =
      virtualDOMElement.parent &&
      virtualDOMElement.subjectivity !== virtualDOMElement.parent.subjectivity;
    if (networkedDOMConnection && hasOwnSubjectivity) {
      for (const id of virtualDOMElement.subjectivity.visibleTo) {
        const remapped = networkedDOMConnection.internalIdToExternalId.get(id);
        if (remapped !== undefined) {
          visibleTo.push(remapped);
        }
      }
      for (const id of virtualDOMElement.subjectivity.hiddenFrom) {
        const remapped = networkedDOMConnection.internalIdToExternalId.get(id);
        if (remapped !== undefined) {
          hiddenFrom.push(remapped);
        }
      }
    }

    const node: NetworkedDOMV02ElementNodeDescription = {
      type: "element",
      nodeId: virtualDOMElement.nodeId,
      tag: emittedTagName,
      attributes: filteredV02Attributes(virtualDOMElement.attributes, excludedAttributes),
      children: [],
      text: virtualDOMElement.textContent,
      visibleTo,
      hiddenFrom,
    };

    for (const child of virtualDOMElement.childNodes) {
      const childNodeDescription = describeNodeWithChildrenForV02Connection(
        child,
        networkedDOMConnection,
      );
      if (childNodeDescription) {
        node.children.push(childNodeDescription);
      }
    }
    return node;
  }
}
