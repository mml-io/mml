import { findElementInCode } from "./codeLocate";
import type { AttributeValue, TransformValues } from "./types";

const TRANSFORM_ATTR_MAP: Record<keyof TransformValues, string> = {
  x: "x",
  y: "y",
  z: "z",
  rx: "rx",
  ry: "ry",
  rz: "rz",
  sx: "sx",
  sy: "sy",
  sz: "sz",
};

function updateAttributeInTag(tagContent: string, attrName: string, value: AttributeValue): string {
  const attrRegex = new RegExp(`\\s*\\b${attrName}=["'][^"']*["']`, "i");
  const hasAttr = attrRegex.test(tagContent);

  if (value === undefined || value === null) {
    return hasAttr ? tagContent.replace(attrRegex, "") : tagContent;
  }

  const formattedValue = value.toString();
  return hasAttr
    ? tagContent.replace(attrRegex, ` ${attrName}="${formattedValue}"`)
    : tagContent.replace(/>$/, ` ${attrName}="${formattedValue}">`);
}

export function updateElementTransformInCode(
  code: string,
  element: HTMLElement,
  values: TransformValues,
): string | null {
  const elementPos = findElementInCode(code, element);
  if (!elementPos) return null;

  let newTagContent = elementPos.tagContent;
  for (const [key, attrName] of Object.entries(TRANSFORM_ATTR_MAP)) {
    const value = values[key as keyof TransformValues];
    newTagContent = updateAttributeInTag(newTagContent, attrName, value);
  }

  return code.substring(0, elementPos.start) + newTagContent + code.substring(elementPos.end);
}

export function updateElementAttributesInCode(
  code: string,
  element: HTMLElement,
  attributes: Record<string, AttributeValue>,
): string | null {
  const elementPos = findElementInCode(code, element);
  if (!elementPos) return null;

  let newTagContent = elementPos.tagContent;
  for (const [attrName, value] of Object.entries(attributes)) {
    newTagContent = updateAttributeInTag(newTagContent, attrName, value);
  }

  return code.substring(0, elementPos.start) + newTagContent + code.substring(elementPos.end);
}

export function updateElementsAttributesInCode(
  code: string,
  elements: HTMLElement[],
  attributes: Record<string, AttributeValue>,
): string | null {
  let updatedCode = code;

  for (const element of elements) {
    const nextCode = updateElementAttributesInCode(updatedCode, element, attributes);
    if (!nextCode) return null;
    updatedCode = nextCode;
  }

  return updatedCode;
}
