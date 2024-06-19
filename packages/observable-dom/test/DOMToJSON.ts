export type DOMToJSONOptions = {
  includeScriptContents: boolean;
  ignoreWhitespaceTextNodes: boolean;
};

export function DOMToJSON(node: Node, options: DOMToJSONOptions): any {
  if (node.nodeType === 3) {
    // Text node
    if (options.ignoreWhitespaceTextNodes && !node.textContent?.trim()) {
      return null;
    }
    return node.textContent;
  }

  const nodeName = node.nodeName;
  const attributes = (node as any).attributes;
  const attributeString =
    attributes && attributes.length
      ? " " +
        Array.from(attributes)
          .map((attr: { name: string; value: string }) => `${attr.name}="${attr.value}"`)
          .join(" ")
      : "";

  const key = nodeName + attributeString;

  const obj: {
    node: string;
    childNodes?: Array<ReturnType<typeof DOMToJSON>>;
  } = {
    node: key,
  };
  if (node.childNodes) {
    if (nodeName === "SCRIPT" && !options.includeScriptContents) {
      obj.childNodes = [];
    } else {
      const childNodes = Array.from(node.childNodes)
        .map((child) => DOMToJSON(child, options))
        .filter((x) => x);
      if (childNodes && childNodes.length) {
        obj.childNodes = childNodes;
      }
    }
  }
  return obj;
}
