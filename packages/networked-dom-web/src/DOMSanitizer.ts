import { IDocumentFactory, IElementLike, INodeLike, isElementLike } from "./DocumentInterface";

export type DOMSanitizerOptions = {
  tagPrefix?: string; // e.g. "m-" to restrict to only custom elements with a tag name starting with "m-"
  replacementTagPrefix?: string; // e.g. "x-" to replace non-prefixed tags with a new prefix (e.g. "div" -> "x-div")
};

export class DOMSanitizer {
  /** Tags whose content and attributes are always stripped. */
  static readonly BLOCKED_TAGS = new Set(["script", "object", "iframe"]);

  /**
   * Returns true if a tag with the given name should be stripped of all
   * content and attributes during sanitisation.
   */
  static isBlockedTag(tagName: string): boolean {
    return DOMSanitizer.BLOCKED_TAGS.has(tagName.toLowerCase());
  }

  /**
   * Given a tag name and sanitisation options, returns the sanitised tag name.
   * Non-prefixed tags are renamed (e.g. "div" → "x-div"). Returns null for
   * blocked tags that should be skipped entirely.
   */
  static sanitiseTagName(tagName: string, options: DOMSanitizerOptions): string | null {
    const tag = tagName.toLowerCase();
    if (DOMSanitizer.isBlockedTag(tag)) {
      return null;
    }
    if (options.tagPrefix && !tag.startsWith(options.tagPrefix.toLowerCase())) {
      return (options.replacementTagPrefix ?? "x-") + tag;
    }
    return tag;
  }

  /**
   * Sanitises a DOM node in-place. When tag replacement occurs (via tagPrefix option),
   * the returned node may be a different object than the input node.
   */
  static sanitise(
    node: INodeLike,
    options: DOMSanitizerOptions = {},
    doc?: IDocumentFactory,
  ): INodeLike {
    // Check blocked tags before any renaming so the original tag name is used
    if (DOMSanitizer.isBlockedTag(node.nodeName)) {
      if (isElementLike(node)) {
        node.innerHTML = "";
        DOMSanitizer.stripAllAttributes(node);
      }
    } else {
      if (isElementLike(node)) {
        let element: IElementLike = node;
        for (const attr of element.getAttributeNames()) {
          if (!DOMSanitizer.IsValidAttributeName(attr)) {
            element.removeAttribute(attr);
          }
        }

        if (options.tagPrefix) {
          const tag = element.nodeName.toLowerCase();
          if (!tag.startsWith(options.tagPrefix.toLowerCase())) {
            element = DOMSanitizer.replaceNodeTagName(
              element,
              (options.replacementTagPrefix ?? "x-") + tag,
              doc,
            );
            node = element;
          }
        }

        for (const attr of element.getAttributeNames()) {
          if (!DOMSanitizer.shouldAcceptAttribute(attr)) {
            element.removeAttribute(attr);
          }
        }
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        DOMSanitizer.sanitise(node.childNodes[i], options, doc);
      }
    }
    return node;
  }

  static replaceNodeTagName(node: IElementLike, newTagName: string, doc?: IDocumentFactory) {
    if (!doc && typeof document === "undefined") {
      throw new Error(
        "DOMSanitizer.replaceNodeTagName requires a document factory (IDocumentFactory) in non-browser environments",
      );
    }
    const docFactory: IDocumentFactory = doc ?? document;
    const replacementNode = docFactory.createElement(newTagName);
    while (node.firstChild) {
      replacementNode.appendChild(node.firstChild);
    }
    for (let index = node.attributes.length - 1; index >= 0; --index) {
      replacementNode.setAttribute(node.attributes[index].name, node.attributes[index].value);
    }
    node.parentNode?.replaceChild(replacementNode, node);
    return replacementNode;
  }

  static stripAllAttributes(node: IElementLike) {
    if (node.getAttributeNames) {
      for (const attr of node.getAttributeNames()) {
        node.removeAttribute(attr);
      }
    }
  }

  static IsASCIIDigit(c: string): boolean {
    return c >= "0" && c <= "9";
  }

  static IsASCIIAlpha(c: string) {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
  }

  static IsValidAttributeName(characters: string): boolean {
    const c = characters[0];
    if (!(DOMSanitizer.IsASCIIAlpha(c) || c === ":" || c === "_")) {
      return false;
    }

    for (let i = 1; i < characters.length; i++) {
      const c = characters[i];
      if (
        !(
          DOMSanitizer.IsASCIIDigit(c) ||
          DOMSanitizer.IsASCIIAlpha(c) ||
          c === ":" ||
          c === "_" ||
          c === "-" ||
          c === "."
        )
      ) {
        return false;
      }
    }

    return true;
  }

  static shouldAcceptAttribute(attribute: string) {
    if (!DOMSanitizer.IsValidAttributeName(attribute)) {
      console.warn("Invalid attribute name", attribute);
      return false;
    }

    // TODO - this might be overly restrictive - apologies to someone that finds this because you have a non-event attribute filtered by this
    return !attribute.startsWith("on");
  }
}
