import { pathsEqual } from "./mmlPaths";
import type { CodeRange } from "./types";

function getElementSignature(element: HTMLElement): {
  tagName: string;
  id?: string;
  attrs: Map<string, string>;
} {
  const tagName = element.tagName.toLowerCase();
  const id = element.id || undefined;
  const attrs = new Map<string, string>();
  for (const attr of Array.from(element.attributes)) {
    if (attr.name !== "id") {
      attrs.set(attr.name, attr.value);
    }
  }
  return { tagName, id, attrs };
}

export function findElementInCode(
  code: string,
  element: HTMLElement,
): { start: number; end: number; tagContent: string } | null {
  const signature = getElementSignature(element);
  const tagRegex = new RegExp(`<${signature.tagName}\\b[^>]*>`, "gi");

  let match: RegExpExecArray | null;
  let bestMatch: { start: number; end: number; tagContent: string } | null = null;
  let bestScore = -1;

  while ((match = tagRegex.exec(code)) !== null) {
    const tagContent = match[0];
    let score = 0;

    if (signature.id) {
      const idMatch = tagContent.match(/\bid=["']([^"']*)["']/i);
      if (idMatch && idMatch[1] === signature.id) {
        score += 100;
      }
    }

    for (const [attrName, attrValue] of signature.attrs) {
      const attrRegex = new RegExp(`\\b${attrName}=["']([^"']*)["']`, "i");
      const attrMatch = tagContent.match(attrRegex);
      if (attrMatch) {
        score += 1;
        if (
          attrMatch[1] === attrValue &&
          !["x", "y", "z", "rx", "ry", "rz", "sx", "sy", "sz"].includes(attrName)
        ) {
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

  return bestMatch;
}

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

function findMatchingClosingTagRange(
  code: string,
  tagName: string,
  searchFrom: number,
): { start: number; end: number } | null {
  const tagPattern = new RegExp(`<\\/?\\s*${tagName}\\b[^>]*>`, "gi");
  tagPattern.lastIndex = searchFrom;

  let depth = 0;

  while (true) {
    const match = tagPattern.exec(code);
    if (!match) return null;

    const text = match[0];
    const isClosing = text.startsWith("</");
    const isSelfClosing = /\/\s*>$/.test(text);

    if (!isClosing && !isSelfClosing) {
      depth += 1;
      continue;
    }

    if (isClosing) {
      if (depth === 0) {
        return { start: match.index, end: match.index + text.length };
      }
      depth -= 1;
    }
  }
}

export function getElementCodeRange(code: string, element: HTMLElement): CodeRange | null {
  const elementPos = findElementInCode(code, element);
  if (!elementPos) return null;

  const tagName = element.tagName.toLowerCase();
  const isSelfClosing = /\/\s*>$/.test(elementPos.tagContent);
  if (isSelfClosing) {
    return offsetsToCodeRange(code, elementPos.start, elementPos.end);
  }

  const closingPos = findMatchingClosingTagRange(code, tagName, elementPos.end);
  if (closingPos) {
    return offsetsToCodeRange(code, elementPos.start, closingPos.end);
  }

  return offsetsToCodeRange(code, elementPos.start, elementPos.end);
}

// Re-export to avoid churn for callers that used this equality helper elsewhere.
export { pathsEqual };
