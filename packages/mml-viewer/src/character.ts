function applyCharacterAttribute(mmlRoot: Element, newValue: string, attributeName: string) {
  // If the root tag is not an m-character, we don't have a character to update
  if (!mmlRoot || mmlRoot.tagName.toString() !== "M-CHARACTER") {
    return;
  }

  // Store the original attribute so we can restore it later if the field is cleared
  const originalAttributeName = `x-${attributeName}`;
  const originalValue = mmlRoot.getAttribute(originalAttributeName);
  const currentValue = mmlRoot.getAttribute(attributeName);
  if (newValue) {
    if (!originalValue) {
      mmlRoot.setAttribute(originalAttributeName, currentValue || "");
    }
    if (currentValue !== newValue) {
      mmlRoot.setAttribute(attributeName, newValue);
    }
  } else {
    if (originalValue) {
      mmlRoot.setAttribute(attributeName, originalValue);
      mmlRoot.removeAttribute(originalAttributeName);
    }
  }
}

export function applyAnimation(mmlRoot: Element, animation: string) {
  applyCharacterAttribute(mmlRoot, animation, "anim");
}

export function applySrcUrl(mmlRoot: Element, avatarUrl: string) {
  applyCharacterAttribute(mmlRoot, avatarUrl, "src");
}
