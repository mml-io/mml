import { IDocumentFactory, IElementLike, isPortalElement } from "./DocumentInterface";
import { DOMSanitizer } from "./DOMSanitizer";
import { NetworkedDOMWebsocketOptions } from "./NetworkedDOMWebsocket";

// These tags are always disallowed because they allow arbitrary HTML to be injected
const ALWAYS_DISALLOWED_TAGS = new Set(["foreignobject", "iframe", "script"]);

const SVG_TAG_NAMES_ADJUSTMENT_MAP = new Map(
  [
    "svg",
    "defs",
    "g",
    "text",
    "filter",
    "stop",
    "path",
    "rect",
    "line",
    "circle",
    "animate",
    "altGlyph",
    "altGlyphDef",
    "altGlyphItem",
    "animateColor",
    "animateMotion",
    "animateTransform",
    "clipPath",
    "feBlend",
    "feDropShadow",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
    "glyphRef",
    "linearGradient",
    "radialGradient",
    "textPath",
    // `foreignObject` is explicitly disallowed because it allows injecting arbitrary HTML
    // "foreignObject",
  ].map((tn) => [tn.toLowerCase(), tn]),
);

const SVG_ATTRS_ADJUSTMENT_MAP = new Map(
  [
    "attributeName",
    "attributeType",
    "baseFrequency",
    "baseProfile",
    "calcMode",
    "clipPathUnits",
    "diffuseConstant",
    "edgeMode",
    "filterUnits",
    "glyphRef",
    "gradientTransform",
    "gradientUnits",
    "kernelMatrix",
    "kernelUnitLength",
    "keyPoints",
    "keySplines",
    "keyTimes",
    "lengthAdjust",
    "limitingConeAngle",
    "markerHeight",
    "markerUnits",
    "markerWidth",
    "maskContentUnits",
    "maskUnits",
    "numOctaves",
    "pathLength",
    "patternContentUnits",
    "patternTransform",
    "patternUnits",
    "pointsAtX",
    "pointsAtY",
    "pointsAtZ",
    "preserveAlpha",
    "preserveAspectRatio",
    "primitiveUnits",
    "refX",
    "refY",
    "repeatCount",
    "repeatDur",
    "requiredExtensions",
    "requiredFeatures",
    "specularConstant",
    "specularExponent",
    "spreadMethod",
    "startOffset",
    "stdDeviation",
    "stitchTiles",
    "surfaceScale",
    "systemLanguage",
    "tableValues",
    "targetX",
    "targetY",
    "textLength",
    "viewBox",
    "viewTarget",
    "xChannelSelector",
    "yChannelSelector",
    "zoomAndPan",
  ].map((attr) => [attr.toLowerCase(), attr]),
);

/**
 * Remaps attribute names to their proper case for SVG elements
 */
export function remapAttributeName(attrName: string): string {
  const remapped = SVG_ATTRS_ADJUSTMENT_MAP.get(attrName.toLowerCase());
  if (remapped) {
    return remapped;
  }
  return attrName;
}

/**
 * Creates an HTML Element (and optionally SVG Elements) with proper namespace handling
 */
export function createElementWithSVGSupport(
  tag: string,
  options: NetworkedDOMWebsocketOptions = {},
  doc?: IDocumentFactory,
): IElementLike {
  if (!doc && typeof document === "undefined") {
    throw new Error(
      "createElementWithSVGSupport requires a document factory (IDocumentFactory) in non-browser environments",
    );
  }
  const docFactory: IDocumentFactory = doc ?? document;
  let filteredTag = tag.toLowerCase();

  if (ALWAYS_DISALLOWED_TAGS.has(filteredTag.toLowerCase())) {
    console.error("Disallowing tag", filteredTag);
    filteredTag = options.replacementTagPrefix ? options.replacementTagPrefix + tag : `x-${tag}`;
  }

  let svgTagMapping;
  if (options.allowSVGElements) {
    svgTagMapping = SVG_TAG_NAMES_ADJUSTMENT_MAP.get(filteredTag);
  }

  if (svgTagMapping) {
    filteredTag = svgTagMapping;
    const xmlns = "http://www.w3.org/2000/svg";
    if (docFactory.createElementNS) {
      return docFactory.createElementNS(xmlns, filteredTag);
    }
    return docFactory.createElement(filteredTag);
  } else {
    if (options.tagPrefix) {
      if (!tag.toLowerCase().startsWith(options.tagPrefix.toLowerCase())) {
        filteredTag = options.replacementTagPrefix
          ? options.replacementTagPrefix + tag
          : `x-${tag}`;
      }
    }
    return docFactory.createElement(filteredTag);
  }
}

/**
 * Sets attributes on an element with proper SVG attribute name mapping
 */
export function setElementAttribute(element: IElementLike, key: string, value: string): void {
  if (DOMSanitizer.shouldAcceptAttribute(key)) {
    const remappedKey = remapAttributeName(key);
    element.setAttribute(remappedKey, value);
  }
}

/**
 * Gets the target element for children operations, handling portal elements
 */
export function getChildrenTarget(parent: IElementLike): IElementLike {
  if (isPortalElement(parent)) {
    return parent.getPortalElement();
  }
  return parent;
}

/**
 * Gets the target element for removal operations, handling portal elements
 */
export function getRemovalTarget(parent: IElementLike): IElementLike {
  if (isPortalElement(parent)) {
    return parent.getPortalElement();
  }
  return parent;
}
