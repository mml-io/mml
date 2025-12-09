declare function acquireVsCodeApi<T>(): T & {
  postMessage: (message: unknown) => void;
  setState: (state: unknown) => void;
  getState: () => unknown;
};

import {
  createMMLGameClient,
  EditableNetworkedDOM,
  IframeObservableDOMFactory,
  MMLWebClient,
} from "mml-game-engine-client";

type TransformValues = {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
};

type SetContentMessage = {
  type: "setContent";
  content: string;
  uri: string;
  fileName?: string;
};

type UpdateContentMessage = {
  type: "updateContent";
  content: string;
  uri?: string;
};

type SelectionRangeMessage = {
  start: number;
  end: number;
};

type IncomingMessage = SetContentMessage | { type: "ping" | "forceRefresh" };

type PersistedState = {
  content?: string;
  uri?: string;
};

const vscode = acquireVsCodeApi<{
  postMessage: (message: unknown) => void;
  setState: (state: unknown) => void;
  getState: () => unknown;
}>();

const statusDot = document.getElementById("status-dot") as HTMLDivElement | null;
const fileLabel = document.getElementById("filename") as HTMLDivElement | null;
const previewRoot = document.getElementById("preview-root") as HTMLDivElement | null;

let staticDocument: EditableNetworkedDOM | null = null;
let client: MMLWebClient | null = null;
let ready = false;
let lastSanitizedContent: string | null = null;
let currentRawContent: string | null = null;
let currentUri: string | null = null;

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

function stripScriptTags(code: string): string {
  return code.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

function ensureHTMLDocument(code: string): string {
  const hasHtmlTag = /<html[\s>]/i.test(code);
  const hasBodyTag = /<body[\s>]/i.test(code);

  let wrapped = code;

  if (!hasBodyTag) {
    wrapped = `<body>${wrapped}</body>`;
  }

  if (!hasHtmlTag) {
    wrapped = `<html>${wrapped}</html>`;
  }

  return wrapped;
}

function setReadyState(isReady: boolean) {
  ready = isReady;
  if (statusDot) {
    statusDot.classList.toggle("ready", isReady);
  }
}

function setFileLabel(label: string) {
  if (fileLabel) {
    fileLabel.textContent = label;
  }
}

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

function findElementInCode(
  code: string,
  element: HTMLElement,
): { start: number; end: number; tagContent: string } | null {
  const signature = getElementSignature(element);
  const tagRegex = new RegExp(`<${signature.tagName}\\b[^>]*>`, "gi");

  let match;
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

type AttributeValue = string | number | boolean | null | undefined;

function getElementOffsets(element: HTMLElement): SelectionRangeMessage | null {
  if (!currentRawContent) return null;
  const pos = findElementInCode(currentRawContent, element);
  if (!pos) return null;
  return { start: pos.start, end: pos.end };
}

function postSelectionChange(elements: HTMLElement[] | null) {
  const ranges =
    elements
      ?.map((el) => getElementOffsets(el))
      .filter((range): range is SelectionRangeMessage => !!range) ?? [];

  vscode.postMessage({
    type: "selectionChange",
    ranges,
    uri: currentUri ?? undefined,
  });
}

function updateAttributeInTag(tagContent: string, attrName: string, value: AttributeValue): string {
  const attrRegex = new RegExp(`\\s*\\b${attrName}=["'][^"']*["']`, "i");
  const hasAttr = attrRegex.test(tagContent);

  if (value === undefined || value === null) {
    if (hasAttr) {
      return tagContent.replace(attrRegex, "");
    }
    return tagContent;
  }

  const formattedValue = value.toString();

  if (hasAttr) {
    return tagContent.replace(attrRegex, ` ${attrName}="${formattedValue}"`);
  }

  return tagContent.replace(/>$/, ` ${attrName}="${formattedValue}">`);
}

function updateElementTransformInCode(
  code: string,
  element: HTMLElement,
  values: TransformValues,
): string | null {
  const elementPos = findElementInCode(code, element);
  if (!elementPos) {
    console.error("[webview] Could not find element in code for transform update");
    return null;
  }

  let newTagContent = elementPos.tagContent;
  for (const [key, attrName] of Object.entries(TRANSFORM_ATTR_MAP)) {
    const value = values[key as keyof TransformValues];
    newTagContent = updateAttributeInTag(newTagContent, attrName, value);
  }

  return code.substring(0, elementPos.start) + newTagContent + code.substring(elementPos.end);
}

function loadContent(raw: string, uri?: string) {
  if (!staticDocument) return;
  currentRawContent = raw;
  if (uri) {
    currentUri = uri;
  }
  const sanitized = ensureHTMLDocument(stripScriptTags(raw || ""));
  if (sanitized === lastSanitizedContent) {
    vscode.setState({ content: raw, uri: currentUri ?? undefined });
    return;
  }

  lastSanitizedContent = sanitized;
  setTimeout(() => {
    staticDocument?.load(sanitized);
  }, 100);
  vscode.setState({ content: raw, uri: currentUri ?? undefined });
}

function handleTransformCommit(element: HTMLElement, values: TransformValues) {
  if (!currentRawContent) {
    console.warn("[webview] Ignoring transform commit without content");
    return;
  }

  const updatedCode = updateElementTransformInCode(currentRawContent, element, values);
  if (!updatedCode) {
    return;
  }

  currentRawContent = updatedCode;
  loadContent(updatedCode, currentUri ?? undefined);

  const message: UpdateContentMessage = {
    type: "updateContent",
    content: updatedCode,
    uri: currentUri ?? undefined,
  };
  vscode.postMessage(message);
}

async function boot() {
  if (!previewRoot) {
    console.error("Preview root not found");
    return;
  }

  console.log("Booting MML preview");

  staticDocument = new EditableNetworkedDOM(
    "vscode-mml-preview",
    IframeObservableDOMFactory,
    false,
  );
  client = await createMMLGameClient({ mode: "editor" });
  console.log("MML client created", client);

  client.element.style.width = "100%";
  client.element.style.height = "100%";
  client.element.style.position = "absolute";
  client.element.style.inset = "0";

  previewRoot.appendChild(client.element);
  client.fitContainer();
  console.log("Connecting to document", staticDocument);
  client.connectToDocument(staticDocument, "wss://mml-preview.local");
  console.log("Document connected");

  client.setEditorCallbacks({
    onSelectionChange: (elements) => postSelectionChange(elements as HTMLElement[] | null),
    onTransformCommit: (element, values) =>
      handleTransformCommit(element, values as TransformValues),
  });

  window.addEventListener("resize", () => client?.fitContainer());

  console.log("Getting persisted state");
  const persisted = vscode.getState() as PersistedState | undefined;
  console.log("Persisted state", persisted);
  if (persisted?.content) {
    console.log("Loading content", persisted.content);
    currentUri = persisted.uri ?? null;
    loadContent(persisted.content, persisted.uri);
  }

  setReadyState(true);
  vscode.postMessage({ type: "ready" });
}

window.addEventListener("message", (event: MessageEvent<IncomingMessage>) => {
  const message = event.data;
  if (!message) return;

  if (message.type === "setContent") {
    if (message.fileName) {
      setFileLabel(message.fileName);
    }
    console.log("Loading content", message.content);
    loadContent(message.content, message.uri);
  }
});

boot().catch((error) => {
  console.error("Failed to start MML preview", error);
  setFileLabel("Failed to start preview");
});
