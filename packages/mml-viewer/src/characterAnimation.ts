export function applyCharacterAnimation(mmlRoot: Element, animation: string) {
  // If the root tag is not an m-character, we don't have a character to animate
  if (!mmlRoot || mmlRoot.tagName.toString() !== "M-CHARACTER") {
    return;
  }

  // Store the original animation attribute so we can restore it later if the animation field is cleared
  const originalAnimationAttr = "x-anim";
  let originalAnimation = mmlRoot.getAttribute(originalAnimationAttr);
  const currentAnimation = mmlRoot.getAttribute("anim");
  if (animation) {
    if (!originalAnimation) {
      originalAnimation = currentAnimation || "";
      mmlRoot.setAttribute(originalAnimationAttr, originalAnimation);
    }
    if (currentAnimation !== animation) {
      mmlRoot.setAttribute("anim", animation);
    }
  } else {
    if (originalAnimation) {
      mmlRoot.setAttribute("anim", originalAnimation);
    } else {
      mmlRoot.removeAttribute("anim");
    }
  }
}
