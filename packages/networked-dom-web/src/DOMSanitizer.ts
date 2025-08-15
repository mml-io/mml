export type DOMSanitizerOptions = {
  tagPrefix?: string; // e.g. "m-" to restrict to only custom elements with a tag name starting with "m-"
  replacementTagPrefix?: string; // e.g. "x-" to replace non-prefixed tags with a new prefix (e.g. "div" -> "x-div")
};

export class DOMSanitizer {
  static sanitise(node: HTMLElement, options: DOMSanitizerOptions = {}) {
    if (node.getAttributeNames) {
      for (const attr of node.getAttributeNames()) {
        if (!DOMSanitizer.IsValidAttributeName(attr)) {
          node.removeAttribute(attr);
        }
      }
    }

    if (node instanceof HTMLElement) {
      if (options.tagPrefix) {
        const tag = node.nodeName.toLowerCase();
        if (!tag.startsWith(options.tagPrefix.toLowerCase())) {
          node = DOMSanitizer.replaceNodeTagName(
            node,
            options.replacementTagPrefix ? options.replacementTagPrefix + tag : `x-${tag}`,
          );
        }
      }
    }

    if (node.nodeName === "SCRIPT" || node.nodeName === "OBJECT" || node.nodeName === "IFRAME") {
      // set contents to empty string
      node.innerHTML = "";
      DOMSanitizer.stripAllAttributes(node);
    } else {
      if (node.getAttributeNames) {
        for (const attr of node.getAttributeNames()) {
          if (!DOMSanitizer.shouldAcceptAttribute(attr)) {
            node.removeAttribute(attr);
          }
        }
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        DOMSanitizer.sanitise(node.childNodes[i] as HTMLElement, options);
      }
    }
    return node;
  }

  static replaceNodeTagName(node: HTMLElement, newTagName: string) {
    const replacementNode = document.createElement(newTagName);
    let index;
    while (node.firstChild) {
      replacementNode.appendChild(node.firstChild);
    }
    for (index = node.attributes.length - 1; index >= 0; --index) {
      replacementNode.setAttribute(node.attributes[index].name, node.attributes[index].value);
    }
    node.parentNode?.replaceChild(replacementNode, node);
    return replacementNode;
  }

  static stripAllAttributes(node: HTMLElement) {
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
