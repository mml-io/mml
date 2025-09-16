import {
  TransformableElement
} from "./chunk-WEASMKVF.js";

// src/calculateContentBounds.ts
function calculateContentBounds(rootElement) {
  let minX = null;
  let minY = null;
  let minZ = null;
  let maxX = null;
  let maxY = null;
  let maxZ = null;
  const traverse = (element) => {
    if (TransformableElement.isTransformableElement(element)) {
      const bounds = element.getContentBounds();
      if (bounds) {
        bounds.getCorners().forEach((corner) => {
          if (minX === null || corner.x < minX) {
            minX = corner.x;
          }
          if (minY === null || corner.y < minY) {
            minY = corner.y;
          }
          if (minZ === null || corner.z < minZ) {
            minZ = corner.z;
          }
          if (maxX === null || corner.x > maxX) {
            maxX = corner.x;
          }
          if (maxY === null || corner.y > maxY) {
            maxY = corner.y;
          }
          if (maxZ === null || corner.z > maxZ) {
            maxZ = corner.z;
          }
        });
      }
    }
    element.childNodes.forEach((child) => {
      traverse(child);
    });
  };
  traverse(rootElement);
  if (minX === null || minY === null || minZ === null || maxX === null || maxY === null || maxZ === null) {
    return {
      min: { x: -0.5, y: -0.5, z: -0.5 },
      max: { x: 0.5, y: 0.5, z: 0.5 }
    };
  }
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ }
  };
}

// src/characterAnimation.ts
function applyCharacterAnimation(mmlRoot, animation) {
  if (!mmlRoot || mmlRoot.tagName.toString() !== "M-CHARACTER") {
    return false;
  }
  const originalAnimationAttr = "x-anim";
  const originalAnimation = mmlRoot.getAttribute(originalAnimationAttr);
  const currentAnimation = mmlRoot.getAttribute("anim");
  if (animation) {
    if (!originalAnimation) {
      mmlRoot.setAttribute(originalAnimationAttr, currentAnimation || "");
    }
    if (currentAnimation !== animation) {
      mmlRoot.setAttribute("anim", animation);
      return true;
    }
  } else {
    if (originalAnimation) {
      mmlRoot.setAttribute("anim", originalAnimation);
      mmlRoot.removeAttribute(originalAnimationAttr);
      return true;
    }
  }
  return false;
}

// src/env-maps/cloudysky_2k.jpg
var cloudysky_2k_default = "./cloudysky_2k-WS2HEI54.jpg";

// src/env-maps/index.ts
var envMaps = {
  cloudysky: {
    name: "Cloudy Sky",
    url: cloudysky_2k_default
  }
};

// src/parseXYZ.ts
function parseXYZ(str) {
  const asNumbers = str.split(",").slice(0, 3).map(parseFloat).map((v) => isNaN(v) ? 0 : v);
  return [asNumbers[0] || 0, asNumbers[1] || 0, asNumbers[2] || 0];
}

export {
  calculateContentBounds,
  applyCharacterAnimation,
  envMaps,
  parseXYZ
};
//# sourceMappingURL=chunk-WACRNF2N.js.map
