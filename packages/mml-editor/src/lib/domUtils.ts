import { CodeRange, TransformValues } from "../state/editorStore";

/**
 * DOM utilities for element path-based selection tracking.
 * Paths are arrays of child indices that can survive DOM mutations.
 */

/**
 * Find the body element within a remote holder element.
 * Searches recursively for an element whose tagName ends with "BODY".
 */
export function bodyFromRemoteHolderElement(remoteHolderElement: HTMLElement): HTMLElement | null {
  const findBodyElement = (element: HTMLElement): HTMLElement | null => {
    if (element.tagName.endsWith("BODY")) {
      return element;
    }

    for (let i = 0; i < element.children.length; i++) {
      const child = element.children[i] as HTMLElement;
      const result = findBodyElement(child);
      if (result) {
        return result;
      }
    }

    return null;
  };

  const body = findBodyElement(remoteHolderElement);
  if (body) return body;

  // Fallback to a remote document element if present (some environments mount the DOM there)
  const remoteDoc = remoteHolderElement.querySelector("m-remote-document") as HTMLElement | null;
  if (remoteDoc) return remoteDoc;

  // Final fallback to the holder itself so callers can still traverse children
  return remoteHolderElement;
}

/**
 * Convert an element to a path of child indices relative to the remote holder's body.
 * The path can be used to re-find the element after DOM mutations.
 */
export function elementToPath(remoteHolder: HTMLElement, element: HTMLElement): number[] {
  const root = bodyFromRemoteHolderElement(remoteHolder);
  const path: number[] = [];
  let currentElement: HTMLElement | undefined = element;
  
  while (currentElement && currentElement !== root) {
    const parentChildren = Array.from(currentElement?.parentElement?.children || []);
    path.push(parentChildren.indexOf(currentElement));
    currentElement = currentElement.parentElement || undefined;
  }
  
  return path.reverse();
}

/**
 * Convert a path of child indices back to an element.
 * Returns null if the path is invalid or the element no longer exists.
 */
export function pathToElement(root: HTMLElement | null, path: number[]): HTMLElement | null {
  if (!root) return null;
  
  let currentElement: HTMLElement | null = root;
  for (const index of path) {
    if (!currentElement || index < 0 || index >= currentElement.children.length) {
      return null;
    }
    currentElement = currentElement.children[index] as HTMLElement;
  }
  
  return currentElement;
}

/**
 * Check if two paths are equal.
 */
export function pathsEqual(pathA: number[], pathB: number[]): boolean {
  if (pathA.length !== pathB.length) return false;
  return pathA.every((val, idx) => val === pathB[idx]);
}

/**
 * Check if a path exists in an array of paths.
 */
export function pathExistsIn(path: number[], paths: number[][]): boolean {
  return paths.some((p) => pathsEqual(p, path));
}

/**
 * Remove a path from an array of paths, returning the new array.
 */
export function removePath(path: number[], paths: number[][]): number[][] {
  return paths.filter((p) => !pathsEqual(p, path));
}

/**
 * Resolve multiple paths to elements, filtering out any that don't exist.
 */
export function resolvePathsToElements(
  remoteHolder: HTMLElement | null,
  paths: number[][],
): HTMLElement[] {
  if (!remoteHolder) return [];
  
  const root = bodyFromRemoteHolderElement(remoteHolder);
  if (!root) return [];
  
  return paths
    .map((path) => pathToElement(root, path))
    .filter((el): el is HTMLElement => el !== null);
}

/**
 * Transform attribute names that map to element attributes.
 */
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

/**
 * Get a unique identifier for an element to find it in the code.
 * Uses tag name, id, and other unique attributes.
 */
function getElementSignature(element: HTMLElement): { tagName: string; id?: string; attrs: Map<string, string> } {
  const tagName = element.tagName.toLowerCase();
  const id = element.id || undefined;
  const attrs = new Map<string, string>();
  
  // Collect attributes for matching
  for (const attr of Array.from(element.attributes)) {
    if (attr.name !== "id") {
      attrs.set(attr.name, attr.value);
    }
  }
  
  return { tagName, id, attrs };
}

/**
 * Find an element's opening tag in the code and return its position info.
 * Returns the start index, end index of the opening tag, and the tag content.
 */
export function findElementInCode(
  code: string,
  element: HTMLElement,
): { start: number; end: number; tagContent: string } | null {
  const signature = getElementSignature(element);
  console.log("[domUtils] Finding element in code:", signature.tagName, signature.id ? `#${signature.id}` : "");
  
  // Create regex to find the opening tag
  const tagRegex = new RegExp(`<${signature.tagName}\\b[^>]*>`, "gi");
  
  let match;
  let bestMatch: { start: number; end: number; tagContent: string } | null = null;
  let bestScore = -1;
  
  while ((match = tagRegex.exec(code)) !== null) {
    const tagContent = match[0];
    let score = 0;
    
    // Score based on attribute matches
    if (signature.id) {
      const idMatch = tagContent.match(/\bid=["']([^"']*)["']/i);
      if (idMatch && idMatch[1] === signature.id) {
        score += 100; // Strong match on ID
      }
    }
    
    // Match other attributes
    for (const [attrName, attrValue] of signature.attrs) {
      const attrRegex = new RegExp(`\\b${attrName}=["']([^"']*)["']`, "i");
      const attrMatch = tagContent.match(attrRegex);
      if (attrMatch) {
        score += 1;
        // Bonus for exact value match (except transform attrs which may differ)
        if (attrMatch[1] === attrValue && !["x", "y", "z", "rx", "ry", "rz", "sx", "sy", "sz"].includes(attrName)) {
          score += 5;
        }
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        start: match.index,
        end: match.index + tagContent.length,
        tagContent,
      };
    }
  }
  
  if (bestMatch) {
    console.log("[domUtils] Found element at index", bestMatch.start, "with score", bestScore);
  } else {
    console.log("[domUtils] Could not find element in code");
  }
  
  return bestMatch;
}

/**
 * Convert a character offset in code into a Monaco-compatible position (1-based line/column).
 */
function offsetToLineColumn(code: string, offset: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, code.length));
  let line = 1;
  let column = 1;

  for (let i = 0; i < clamped; i++) {
    if (code[i] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

/**
 * Convert start/end offsets into a Monaco code range.
 */
export function offsetsToCodeRange(code: string, start: number, end: number): CodeRange {
  const startPos = offsetToLineColumn(code, start);
  const endPos = offsetToLineColumn(code, end);

  return {
    startLine: startPos.line,
    startColumn: startPos.column,
    endLine: endPos.line,
    endColumn: endPos.column,
  };
}

/**
 * Compute the code range that corresponds to an element's opening tag.
 * Returns null if the element cannot be located in the provided code.
 */
export function getElementCodeRange(code: string, element: HTMLElement): CodeRange | null {
  const elementPos = findElementInCode(code, element);
  if (!elementPos) {
    return null;
  }

  return offsetsToCodeRange(code, elementPos.start, elementPos.end);
}

export type AttributeValue = string | number | boolean | null | undefined;

/**
 * Update an attribute value in a tag string.
 * If the attribute exists, updates it. If not, adds it.
 * If value is undefined or null, removes the attribute.
 */
function updateAttributeInTag(tagContent: string, attrName: string, value: AttributeValue): string {
  const attrRegex = new RegExp(`\\s*\\b${attrName}=["'][^"']*["']`, "i");
  const hasAttr = attrRegex.test(tagContent);
  
  if (value === undefined || value === null) {
    // Remove the attribute
    if (hasAttr) {
      return tagContent.replace(attrRegex, "");
    }
    return tagContent;
  }
  
  const formattedValue = value.toString();
  
  if (hasAttr) {
    // Update existing attribute
    return tagContent.replace(attrRegex, ` ${attrName}="${formattedValue}"`);
  } else {
    // Add new attribute before the closing >
    return tagContent.replace(/>$/, ` ${attrName}="${formattedValue}">`);
  }
}

/**
 * Update the code with new transform values for an element.
 * Returns the updated code string or null if element couldn't be found.
 */
export function updateElementTransformInCode(
  code: string,
  element: HTMLElement,
  values: TransformValues,
): string | null {
  console.log("[domUtils] updateElementTransformInCode called with values:", values);
  
  const elementPos = findElementInCode(code, element);
  if (!elementPos) {
    console.error("[domUtils] Could not find element in code");
    return null;
  }
  
  let newTagContent = elementPos.tagContent;
  
  // Update each transform attribute
  for (const [key, attrName] of Object.entries(TRANSFORM_ATTR_MAP)) {
    const value = values[key as keyof TransformValues];
    newTagContent = updateAttributeInTag(newTagContent, attrName, value);
  }
  
  console.log("[domUtils] Original tag:", elementPos.tagContent);
  console.log("[domUtils] Updated tag:", newTagContent);
  
  // Replace the tag in the code
  const newCode = code.substring(0, elementPos.start) + newTagContent + code.substring(elementPos.end);
  
  return newCode;
}

/**
 * Update a set of attributes on a single element inside the code string.
 * Returns the updated code or null if the element could not be found.
 */
export function updateElementAttributesInCode(
  code: string,
  element: HTMLElement,
  attributes: Record<string, AttributeValue>,
): string | null {
  const elementPos = findElementInCode(code, element);
  if (!elementPos) {
    console.error("[domUtils] Could not find element in code for attribute update");
    return null;
  }

  let newTagContent = elementPos.tagContent;
  for (const [attrName, value] of Object.entries(attributes)) {
    newTagContent = updateAttributeInTag(newTagContent, attrName, value);
  }

  return code.substring(0, elementPos.start) + newTagContent + code.substring(elementPos.end);
}

/**
 * Update the same set of attributes for multiple elements in the code string.
 * Uses the current code after each element update to preserve offsets.
 * Returns the updated code or null if any element cannot be located.
 */
export function updateElementsAttributesInCode(
  code: string,
  elements: HTMLElement[],
  attributes: Record<string, AttributeValue>,
): string | null {
  let updatedCode = code;

  for (const element of elements) {
    const nextCode = updateElementAttributesInCode(updatedCode, element, attributes);
    if (!nextCode) {
      return null;
    }
    updatedCode = nextCode;
  }

  return updatedCode;
}

