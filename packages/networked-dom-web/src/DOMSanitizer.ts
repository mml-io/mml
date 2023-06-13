export class DOMSanitizer {
  static sanitise(node: HTMLElement) {
    if (node.getAttributeNames) {
      for (const attr of node.getAttributeNames()) {
        if (!DOMSanitizer.IsValidAttributeName(attr)) {
          node.removeAttribute(attr);
        }
      }
    }
    if (node.nodeName === "SCRIPT") {
      // set text to empty string
      node.innerText = "";
    } else {
      if (node.getAttributeNames) {
        for (const attr of node.getAttributeNames()) {
          if (!DOMSanitizer.shouldAcceptAttribute(attr)) {
            node.removeAttribute(attr);
          }
        }
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        DOMSanitizer.sanitise(node.childNodes[i] as HTMLElement);
      }
    }
  }

  static IsASCIIDigit(c: string): boolean {
    return c >= "0" && c <= "9";
  }

  static IsASCIIAlpha(c: string) {
    return c >= "a" && c <= "z";
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
