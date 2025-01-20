import { BufferReader } from "../BufferReader";
import { BufferWriter } from "../BufferWriter";
import { decodeAttributes, encodeAttributes } from "./attributes";

export type NetworkedDOMV02TextNodeDescription = {
  type: "text";
  nodeId: number;
  text: string;
};

export type NetworkedDOMV02ElementNodeDescription = {
  type: "element";
  nodeId: number;
  tag: string;
  attributes: Array<[string, string | null]>;
  children: Array<NetworkedDOMV02NodeDescription>;
  visibleTo?: Array<number>;
  hiddenFrom?: Array<number>;
  text?: string;
};

export type NetworkedDOMV02NodeDescription =
  | NetworkedDOMV02ElementNodeDescription
  | NetworkedDOMV02TextNodeDescription;

export function encodeNodeDescription(
  writer: BufferWriter,
  nodeDescription: NetworkedDOMV02NodeDescription,
): void {
  writer.writeUVarint(nodeDescription.nodeId);

  if (nodeDescription.type === "text") {
    writer.writeLengthPrefixedString(""); // Empty tag indicates text node
    writer.writeLengthPrefixedString(nodeDescription.text);
    return;
  }

  writer.writeLengthPrefixedString(nodeDescription.tag);

  encodeAttributes(writer, nodeDescription.attributes);

  if (!nodeDescription.visibleTo) {
    writer.writeUVarint(0);
  } else {
    writer.writeUVarint(nodeDescription.visibleTo.length);
    for (let i = 0; i < nodeDescription.visibleTo.length; i++) {
      writer.writeUVarint(nodeDescription.visibleTo[i]);
    }
  }

  if (!nodeDescription.hiddenFrom) {
    writer.writeUVarint(0);
  } else {
    writer.writeUVarint(nodeDescription.hiddenFrom.length);
    for (let i = 0; i < nodeDescription.hiddenFrom.length; i++) {
      writer.writeUVarint(nodeDescription.hiddenFrom[i]);
    }
  }

  writer.writeUVarint(nodeDescription.children.length);
  for (let i = 0; i < nodeDescription.children.length; i++) {
    encodeNodeDescription(writer, nodeDescription.children[i]);
  }
}

export function decodeNodeDescription(buffer: BufferReader): NetworkedDOMV02NodeDescription {
  const nodeId = buffer.readUVarint();
  const tag = buffer.readUVarintPrefixedString();
  if (tag === "") {
    // Text node
    const text = buffer.readUVarintPrefixedString();
    return { type: "text", nodeId, text };
  }

  const attributes = decodeAttributes(buffer);

  const visibleToLength = buffer.readUVarint();
  let visibleTo: number[] | undefined;
  if (visibleToLength !== 0) {
    visibleTo = [];
    for (let i = 0; i < visibleToLength; i++) {
      visibleTo.push(buffer.readUVarint());
    }
  }

  const hiddenFromLength = buffer.readUVarint();
  let hiddenFrom: number[] | undefined;
  if (hiddenFromLength !== 0) {
    hiddenFrom = [];
    for (let i = 0; i < hiddenFromLength; i++) {
      hiddenFrom.push(buffer.readUVarint());
    }
  }

  const childrenLength = buffer.readUVarint();
  const children: NetworkedDOMV02NodeDescription[] = [];
  for (let i = 0; i < childrenLength; i++) {
    children.push(decodeNodeDescription(buffer));
  }

  const node: NetworkedDOMV02ElementNodeDescription = {
    type: "element",
    nodeId,
    tag,
    attributes,
    children,
  };

  if (visibleTo) {
    node.visibleTo = visibleTo;
  }
  if (hiddenFrom) {
    node.hiddenFrom = hiddenFrom;
  }

  return node;
}
