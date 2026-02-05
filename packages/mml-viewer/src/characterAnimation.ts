// Returns true if a new animation was applied, false if the animation was cleared or unchanged.
export function applyCharacterAnimation(mmlRoot: Element, animation: string): boolean {
  // If the root tag is not an m-character, we don't have a character to animate
  if (!mmlRoot || mmlRoot.tagName.toString() !== "M-CHARACTER") {
    return false;
  }

  // Store the original animation attribute so we can restore it later if the animation field is cleared
  const originalAnimationAttr = "x-anim";
  const originalAnimation = mmlRoot.getAttribute(originalAnimationAttr);
  const currentAnimation = mmlRoot.getAttribute("anim");
  if (animation) {
    // There is an animation to apply
    if (!originalAnimation) {
      mmlRoot.setAttribute(originalAnimationAttr, currentAnimation || "");
    }
    if (currentAnimation !== animation) {
      mmlRoot.setAttribute("anim", animation);
      return true;
    }
  } else {
    // There is no animation to apply
    if (originalAnimation) {
      // There was an original animation, so we restore it
      mmlRoot.setAttribute("anim", originalAnimation);
      mmlRoot.removeAttribute(originalAnimationAttr);
      return true;
    }
  }
  return false;
}
