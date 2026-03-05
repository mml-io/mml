import {
  DOMSanitizer,
  DOMSanitizerOptions,
  IDocumentFactory,
  INodeLike,
  isElementLike,
} from "@mml-io/networked-dom-web";
import { type DefaultTreeAdapterMap, parse } from "parse5";

type Parse5Node = DefaultTreeAdapterMap["childNode"];
type Parse5Element = DefaultTreeAdapterMap["element"];

let domParser: DOMParser | null = null;

function getDOMParser(): DOMParser | null {
  if (domParser) return domParser;
  if (typeof DOMParser !== "undefined") {
    domParser = new DOMParser();
    return domParser;
  }
  return null;
}

/**
 * Recursively converts a real DOM tree into virtual elements using the provided
 * document factory. Only element and text nodes are converted; other node types
 * (comments, processing instructions) are skipped.
 */
function convertDOMToFactory(realNode: Node, factory: IDocumentFactory): INodeLike | null {
  if (realNode.nodeType === Node.TEXT_NODE) {
    return factory.createTextNode(realNode.textContent ?? "");
  }
  if (realNode.nodeType === Node.ELEMENT_NODE) {
    const el = realNode as Element;
    if (DOMSanitizer.isBlockedTag(el.tagName)) {
      return null;
    }
    const virtual = factory.createElement(el.tagName.toLowerCase());
    for (const attr of el.getAttributeNames()) {
      virtual.setAttribute(attr, el.getAttribute(attr) ?? "");
    }
    for (let i = 0; i < realNode.childNodes.length; i++) {
      const child = convertDOMToFactory(realNode.childNodes[i], factory);
      if (child) {
        virtual.appendChild(child);
      }
    }
    return virtual;
  }
  return null;
}

/**
 * Sanitisation options used for static MML content: only allow m-* tags,
 * replace other tags with x-* prefix.
 */
const sanitiseOptions: DOMSanitizerOptions = { tagPrefix: "m-", replacementTagPrefix: "x-" };

/**
 * Parses HTML text using parse5 and converts directly into elements
 * created by the provided document factory, applying sanitisation rules
 * from DOMSanitizer (blocked tags, tag prefix, attribute validation).
 */
function parseWithParse5(html: string, factory: IDocumentFactory): INodeLike {
  const doc = parse(html);
  const fragment = factory.createDocumentFragment();

  function convertNode(node: Parse5Node): INodeLike | null {
    if (node.nodeName === "#text") {
      const text = (node as DefaultTreeAdapterMap["textNode"]).value;
      if (text.trim() === "") return null;
      return factory.createTextNode(text);
    }
    if ("tagName" in node) {
      const el = node as Parse5Element;
      const tagName = DOMSanitizer.sanitiseTagName(el.tagName, sanitiseOptions);
      if (tagName === null) {
        return null;
      }

      const virtual = factory.createElement(tagName);
      for (const attr of el.attrs) {
        if (DOMSanitizer.shouldAcceptAttribute(attr.name)) {
          virtual.setAttribute(attr.name, attr.value);
        }
      }
      for (const child of el.childNodes) {
        const converted = convertNode(child);
        if (converted) {
          virtual.appendChild(converted);
        }
      }
      return virtual;
    }
    return null;
  }

  // parse5 wraps content in <html><head>...<body>... — walk into <body>
  function walkChildren(nodes: Parse5Node[]): void {
    for (const node of nodes) {
      if (node.nodeName === "html" || node.nodeName === "head" || node.nodeName === "body") {
        walkChildren((node as Parse5Element).childNodes);
      } else {
        const converted = convertNode(node);
        if (converted) {
          fragment.appendChild(converted);
        }
      }
    }
  }

  walkChildren(doc.childNodes as Parse5Node[]);
  return fragment;
}

export async function fetchRemoteStaticMML(
  address: string,
  documentFactory?: IDocumentFactory,
): Promise<INodeLike> {
  const response = await fetch(address);
  const text = await response.text();

  const parser = getDOMParser();

  // When we have a document factory but no DOMParser (headless/non-browser),
  // use parse5 to parse directly into virtual elements.
  if (!parser) {
    if (!documentFactory) {
      throw new Error(
        "Static MML loading requires either a browser environment (DOMParser) " +
          "or a document factory (virtual mode).",
      );
    }
    return parseWithParse5(text, documentFactory);
  }

  // Browser path: parse with DOMParser, sanitise in-place
  const remoteDocumentAsHTMLNode = parser.parseFromString(text, "text/html");
  const sanitised = DOMSanitizer.sanitise(remoteDocumentAsHTMLNode.body, sanitiseOptions);

  if (!documentFactory) {
    return sanitised;
  }

  // Browser + document factory: convert the real DOM tree into virtual elements
  const fragment = documentFactory.createDocumentFragment();
  const sourceNode = isElementLike(sanitised) ? sanitised : remoteDocumentAsHTMLNode.body;
  for (let i = 0; i < sourceNode.childNodes.length; i++) {
    const converted = convertDOMToFactory(sourceNode.childNodes[i] as Node, documentFactory);
    if (converted) {
      fragment.appendChild(converted);
    }
  }
  return fragment;
}
