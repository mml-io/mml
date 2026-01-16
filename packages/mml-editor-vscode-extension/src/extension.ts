import {
  DEFAULT_SNAPPING_CONFIG,
  type ElementPropertyData,
  type SceneNodeData,
  type SelectedElementData,
  type SnappingConfig,
} from "@mml-io/mml-editor-core";
import * as vscode from "vscode";

import { getWebviewHtml } from "./webview/html";
import { getElementSettingsHtml, getSceneOutlineHtml } from "./webview/sidebarHtml";

type PreviewSession = {
  panel: vscode.WebviewPanel;
  boundDocument: vscode.TextDocument;
  disposables: vscode.Disposable[];
  pendingUpdate: ReturnType<typeof setTimeout> | null;
  suppressChangeCount: number;
  selectionDecoration: vscode.TextEditorDecorationType;
  lastSelectionRanges: SelectionRangeMessage[];
  visualizersVisible: boolean;
  snappingEnabled: boolean;
  gizmoMode: "translate" | "rotate" | "scale";
  snappingConfig: SnappingConfig;
  sceneData: SceneNodeData[] | null;
  selectedElements: SelectedElementData[];
  elementProperties: ElementPropertyData[];
};

type SelectionRangeMessage = { start: number; end: number };

const sessions = new Map<string, PreviewSession>();
let lastActiveSession: PreviewSession | null = null;
let sceneOutlineProvider: SceneOutlineProvider | null = null;
let elementSettingsProvider: ElementSettingsProvider | null = null;

export function activate(context: vscode.ExtensionContext) {
  sceneOutlineProvider = new SceneOutlineProvider(context.extensionUri);
  elementSettingsProvider = new ElementSettingsProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("mmlSceneOutline", sceneOutlineProvider),
    vscode.window.registerWebviewViewProvider("mmlElementSettings", elementSettingsProvider),
  );

  const openPreview = vscode.commands.registerCommand("mml.openPreview", () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showWarningMessage("Open an MML document in the editor first.");
      return;
    }
    createBoundPreview(context, activeEditor.document, vscode.ViewColumn.Active);
  });

  const openPreviewSideBySide = vscode.commands.registerCommand("mml.openPreviewSideBySide", () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showWarningMessage("Open an MML document in the editor first.");
      return;
    }
    createBoundPreview(context, activeEditor.document, vscode.ViewColumn.Beside);
  });

  const showCodeOnly = vscode.commands.registerCommand("mml.showCodeOnly", () => {
    const session = getActiveSession();
    if (!session) return;

    // Close the preview panel, keep the code editor
    session.panel.dispose();
  });

  const showPreviewOnly = vscode.commands.registerCommand("mml.showPreviewOnly", async () => {
    const session = getActiveSession();
    if (!session) return;

    // Move preview to the code editor's column, then close the code editor
    const docUri = session.boundDocument.uri;

    // Find and close all editors showing this document
    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        if (
          tab.input instanceof vscode.TabInputText &&
          tab.input.uri.toString() === docUri.toString()
        ) {
          await vscode.window.tabGroups.close(tab);
        }
      }
    }

    session.panel.reveal(vscode.ViewColumn.One);
  });

  const showSplitView = vscode.commands.registerCommand("mml.showSplitView", async () => {
    const session = getActiveSession();
    if (!session) return;

    const docUri = session.boundDocument.uri;
    const doc = await vscode.workspace.openTextDocument(docUri);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    session.panel.reveal(vscode.ViewColumn.Beside);
  });

  const toggleVisualizers = vscode.commands.registerCommand("mml.toggleVisualizers", () => {
    const session = getActiveSession();
    if (!session) return;
    session.visualizersVisible = !session.visualizersVisible;
    session.panel.webview.postMessage({
      type: "setVisualizersVisible",
      visible: session.visualizersVisible,
    });
  });

  const createGizmoCommand = (mode: "translate" | "rotate" | "scale") =>
    vscode.commands.registerCommand(
      `mml.setGizmo${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
      () => {
        const session = getActiveSession();
        if (!session) return;
        session.gizmoMode = mode;
        session.panel.webview.postMessage({ type: "setGizmoMode", mode });
      },
    );

  const setGizmoTranslate = createGizmoCommand("translate");
  const setGizmoRotate = createGizmoCommand("rotate");
  const setGizmoScale = createGizmoCommand("scale");

  const toggleSnapping = vscode.commands.registerCommand("mml.toggleSnapping", () => {
    const session = getActiveSession();
    if (!session) return;
    session.snappingEnabled = !session.snappingEnabled;
    session.panel.webview.postMessage({
      type: "setSnappingEnabled",
      enabled: session.snappingEnabled,
    });
  });

  const focusSceneOutline = vscode.commands.registerCommand("mml.focusSceneOutline", () => {
    vscode.commands.executeCommand("mmlSceneOutline.focus");
  });

  const focusElementSettings = vscode.commands.registerCommand("mml.focusElementSettings", () => {
    vscode.commands.executeCommand("mmlElementSettings.focus");
  });

  context.subscriptions.push(
    openPreview,
    openPreviewSideBySide,
    showCodeOnly,
    showPreviewOnly,
    showSplitView,
    toggleVisualizers,
    setGizmoTranslate,
    setGizmoRotate,
    setGizmoScale,
    toggleSnapping,
    focusSceneOutline,
    focusElementSettings,
  );
}

export function deactivate() {
  sessions.forEach((session) => {
    session.disposables.forEach((d) => d.dispose());
  });
  sessions.clear();
}

function getActiveSession(): PreviewSession | null {
  for (const session of sessions.values()) {
    if (session.panel.active) return session;
  }
  return lastActiveSession;
}

function updateContexts() {
  const hasActiveSession = sessions.size > 0;
  vscode.commands.executeCommand("setContext", "mmlPreviewActive", hasActiveSession);
}

function createBoundPreview(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument,
  column: vscode.ViewColumn,
) {
  const docUri = document.uri.toString();
  const existingSession = sessions.get(docUri);
  if (existingSession) {
    existingSession.panel.reveal(column);
    return;
  }

  const fileName = document.uri.path.split("/").pop() ?? "MML Preview";

  const docDirUri = vscode.Uri.file(dirnameFsPath(document.uri.fsPath));
  const workspaceFolderUri = vscode.workspace.getWorkspaceFolder(document.uri)?.uri;

  const panel = vscode.window.createWebviewPanel("mmlPreview", `Preview: ${fileName}`, column, {
    enableScripts: true,
    retainContextWhenHidden: true,
    // Allow the preview to load local assets referenced by MML (e.g. `/assets/.../duck.glb`)
    // by whitelisting the document folder + workspace folder for `asWebviewUri(...)`.
    localResourceRoots: [
      vscode.Uri.joinPath(context.extensionUri, "dist"),
      docDirUri,
      ...(workspaceFolderUri ? [workspaceFolderUri] : []),
    ],
  });

  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

  const disposables: vscode.Disposable[] = [];
  const selectionDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(255, 215, 0, 0.25)",
    border: "1px solid rgba(255, 185, 0, 0.6)",
  });

  const session: PreviewSession = {
    panel,
    boundDocument: document,
    disposables,
    pendingUpdate: null,
    suppressChangeCount: 0,
    selectionDecoration,
    lastSelectionRanges: [],
    visualizersVisible: true,
    snappingEnabled: true,
    gizmoMode: "translate",
    snappingConfig: DEFAULT_SNAPPING_CONFIG,
    sceneData: null,
    selectedElements: [],
    elementProperties: [],
  };

  sessions.set(docUri, session);
  lastActiveSession = session;
  updateContexts();

  // Set context for keybindings
  disposables.push(
    panel.onDidChangeViewState(() => {
      const isActive = panel.active;
      if (isActive) {
        lastActiveSession = session;
        // Update sidebar panels when this preview becomes active
        sceneOutlineProvider?.updateFromSession(session);
        elementSettingsProvider?.updateFromSession(session);
      }
    }),
  );

  disposables.push(
    panel.onDidDispose(() => {
      disposables.forEach((d) => d.dispose());
      sessions.delete(docUri);
      if (lastActiveSession === session) {
        lastActiveSession = Array.from(sessions.values()).pop() ?? null;
      }
      updateContexts();
      // Clear sidebar panels if no more sessions
      if (sessions.size === 0) {
        sceneOutlineProvider?.clear();
        elementSettingsProvider?.clear();
      } else if (lastActiveSession) {
        sceneOutlineProvider?.updateFromSession(lastActiveSession);
        elementSettingsProvider?.updateFromSession(lastActiveSession);
      }
    }),
  );

  disposables.push(selectionDecoration);

  disposables.push(
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message?.type === "ready") {
        pushDocumentContent(session, session.boundDocument, true);
        // Send initial state
        panel.webview.postMessage({
          type: "setVisualizersVisible",
          visible: session.visualizersVisible,
        });
        panel.webview.postMessage({
          type: "setSnappingEnabled",
          enabled: session.snappingEnabled,
        });
        panel.webview.postMessage({
          type: "setSnappingConfig",
          config: session.snappingConfig,
        });
        panel.webview.postMessage({ type: "setGizmoMode", mode: session.gizmoMode });
      }
      if (message?.type === "updateContent" && typeof message.content === "string") {
        await applyWebviewContentUpdate(session, message.content, message.uri);
      }
      if (message?.type === "selectionChange" && Array.isArray(message.ranges)) {
        applySelectionHighlight(session, message.ranges as SelectionRangeMessage[], message.uri);
      }
      if (message?.type === "sceneDataUpdate") {
        session.sceneData = message.sceneData;
        if (lastActiveSession === session) {
          sceneOutlineProvider?.updateFromSession(session);
        }
      }
      if (message?.type === "selectionDataUpdate") {
        session.selectedElements = message.selectedElements;
        session.elementProperties = message.elementProperties;
        if (lastActiveSession === session) {
          elementSettingsProvider?.updateFromSession(session);
        }
      }
      if (message?.type === "updateSnappingConfig") {
        session.snappingConfig = { ...session.snappingConfig, ...message.config };
      }
      if (message?.type === "updateSnappingEnabled") {
        session.snappingEnabled = message.enabled;
      }
      if (message?.type === "updateVisualizersVisible") {
        session.visualizersVisible = message.visible;
      }
      if (message?.type === "updateGizmoMode") {
        session.gizmoMode = message.mode;
      }
    }),
  );

  disposables.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() !== docUri) {
        return;
      }
      if (session.suppressChangeCount > 0) {
        session.suppressChangeCount -= 1;
        return;
      }
      schedulePush(session, event.document);
    }),
  );

  // Handle document close - close the preview too
  disposables.push(
    vscode.workspace.onDidCloseTextDocument((closedDoc) => {
      if (closedDoc.uri.toString() === docUri) {
        panel.dispose();
      }
    }),
  );

  // Update panel title if document is renamed
  disposables.push(
    vscode.workspace.onDidRenameFiles((event) => {
      for (const file of event.files) {
        if (file.oldUri.toString() === docUri) {
          const newFileName = file.newUri.path.split("/").pop() ?? "MML Preview";
          panel.title = `Preview: ${newFileName}`;
          sessions.delete(docUri);
          sessions.set(file.newUri.toString(), session);
        }
      }
    }),
  );

  pushDocumentContent(session, document, true);
}

function schedulePush(session: PreviewSession, doc: vscode.TextDocument) {
  if (session.pendingUpdate) {
    clearTimeout(session.pendingUpdate);
  }
  session.pendingUpdate = setTimeout(() => {
    pushDocumentContent(session, doc, false);
    session.pendingUpdate = null;
  }, 150);
}

function pushDocumentContent(session: PreviewSession, doc: vscode.TextDocument, force: boolean) {
  const text = doc.getText();
  const uri = doc.uri.toString();
  const fileName =
    doc.uri.scheme === "file" ? (doc.uri.path.split("/").pop() ?? doc.uri.toString()) : uri;

  const contentAddressMap = buildContentAddressMap(session.panel.webview, doc, text);

  session.panel.webview.postMessage({
    type: "setContent",
    content: text,
    uri,
    fileName,
    force,
    contentAddressMap,
  });
}

function buildContentAddressMap(
  webview: vscode.Webview,
  doc: vscode.TextDocument,
  content: string,
): Record<string, string> {
  const map: Record<string, string> = {};

  // Only file-backed documents can be safely mapped to `asWebviewUri(vscode.Uri.file(...))`.
  if (doc.uri.scheme !== "file") {
    return map;
  }

  // Extract common URL-bearing attributes in MML/HTML.
  // Note: keep this conservative and fast; it runs on every document update.
  const attrRegex = /\b(?:src|anim)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;

  const docDirFsPath = dirnameFsPath(doc.uri.fsPath);
  const workspaceFsPath = vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath ?? null;

  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(content)) !== null) {
    const raw = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);

    if (!isProbablyLocalAssetUrl(raw)) continue;

    const normalized = raw.replace(/\\/g, "/");
    const fsPath = resolveAssetFsPath(normalized, docDirFsPath, workspaceFsPath);
    if (!fsPath) continue;

    map[raw] = webview.asWebviewUri(vscode.Uri.file(fsPath)).toString();
  }

  return map;
}

function isProbablyLocalAssetUrl(src: string): boolean {
  // Absolute URLs are already resolvable.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(src)) return false;
  if (src.startsWith("//")) return false;
  if (src.startsWith("#")) return false;
  if (src.startsWith("data:")) return false;
  if (src.startsWith("blob:")) return false;
  return true;
}

function resolveAssetFsPath(
  normalizedSrc: string,
  docDirFsPath: string,
  workspaceFsPath: string | null,
): string | null {
  if (normalizedSrc.startsWith("/")) {
    const rel = normalizedSrc.replace(/^\/+/, "");
    const root = workspaceFsPath ?? docDirFsPath;
    return resolveFsPath(root, rel);
  }
  return resolveFsPath(docDirFsPath, normalizedSrc);
}

function dirnameFsPath(fsPath: string): string {
  // Works for both POSIX and Windows-style paths.
  return fsPath.replace(/[\\/][^\\/]*$/, "");
}

function resolveFsPath(baseFsPath: string, relativePath: string): string {
  // Basic, cross-platform path resolver without relying on Node's `path` module
  // (keeps the extension package's TS config happy).
  const baseParts = baseFsPath.split(/[\\/]+/);
  const relParts = relativePath.split(/[\\/]+/);

  const stack = baseParts.slice();
  for (const part of relParts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(part);
  }

  // Preserve native-ish separator style based on the base path.
  const sep = baseFsPath.includes("\\") ? "\\" : "/";
  const joined = stack.join(sep);

  // Preserve leading separator for POSIX paths.
  const hasLeadingSlash = baseFsPath.startsWith("/");
  return hasLeadingSlash && !joined.startsWith("/") ? `/${joined}` : joined;
}

async function applyWebviewContentUpdate(
  session: PreviewSession,
  newContent: string,
  sourceUri?: string,
) {
  const doc = session.boundDocument;
  if (!doc || doc.isClosed) {
    return;
  }

  const docUri = doc.uri.toString();
  if (sourceUri && docUri !== sourceUri) {
    return;
  }

  const existing = doc.getText();
  if (existing === newContent) {
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(existing.length));
  edit.replace(doc.uri, fullRange, newContent);
  session.suppressChangeCount += 1;
  const success = await vscode.workspace.applyEdit(edit);
  if (!success) {
    session.suppressChangeCount = Math.max(0, session.suppressChangeCount - 1);
    return;
  }

  if (session.lastSelectionRanges.length > 0) {
    applySelectionHighlight(session, session.lastSelectionRanges, docUri);
  }
}

function applySelectionHighlight(
  session: PreviewSession,
  ranges: SelectionRangeMessage[],
  sourceUri?: string,
) {
  const doc = session.boundDocument;
  if (!doc || doc.isClosed) {
    return;
  }

  const docUri = doc.uri.toString();
  if (sourceUri && docUri !== sourceUri) {
    return;
  }

  session.lastSelectionRanges = ranges;

  const text = doc.getText();
  const textLength = text.length;
  const targetEditors = vscode.window.visibleTextEditors.filter(
    (editor) => editor.document.uri.toString() === docUri,
  );

  const vscodeRanges = ranges.map((range) => {
    const startPos = doc.positionAt(Math.max(0, Math.min(range.start, textLength)));
    const endPos = doc.positionAt(Math.max(0, Math.min(range.end, textLength)));
    return new vscode.Range(startPos, endPos);
  });

  targetEditors.forEach((editor) => {
    editor.setDecorations(session.selectionDecoration, vscodeRanges);
    if (vscodeRanges[0]) {
      editor.revealRange(vscodeRanges[0], vscode.TextEditorRevealType.InCenter);
    }
  });
}

// ==================== Sidebar Webview Providers ====================

class SceneOutlineProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = getSceneOutlineHtml(webviewView.webview, this.extensionUri);

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message?.type === "selectElement" && lastActiveSession) {
        // Forward selection to the main preview
        lastActiveSession.panel.webview.postMessage({
          type: "selectElementByPath",
          path: message.path,
          addToSelection: message.addToSelection,
        });
      }
      if (message?.type === "clearSelection" && lastActiveSession) {
        lastActiveSession.panel.webview.postMessage({ type: "clearSelection" });
      }
    });

    // If there's an active session, update immediately
    if (lastActiveSession) {
      this.updateFromSession(lastActiveSession);
    }
  }

  updateFromSession(session: PreviewSession) {
    if (!this.view) return;
    this.view.webview.postMessage({
      type: "updateSceneTree",
      sceneData: session.sceneData,
      selectedPaths: session.selectedElements.map((e) => e.path),
    });
  }

  clear() {
    if (!this.view) return;
    this.view.webview.postMessage({
      type: "updateSceneTree",
      sceneData: null,
      selectedPaths: [],
    });
  }
}

class ElementSettingsProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = getElementSettingsHtml(webviewView.webview, this.extensionUri);

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message?.type === "updateProperty" && lastActiveSession) {
        // Forward property change to the main preview
        lastActiveSession.panel.webview.postMessage({
          type: "updatePropertyFromSidebar",
          propName: message.propName,
          value: message.value,
        });
      }
    });

    // If there's an active session, update immediately
    if (lastActiveSession) {
      this.updateFromSession(lastActiveSession);
    }
  }

  updateFromSession(session: PreviewSession) {
    if (!this.view) return;
    this.view.webview.postMessage({
      type: "updateElementSettings",
      selectedElements: session.selectedElements,
      properties: session.elementProperties,
      snappingEnabled: session.snappingEnabled,
      snappingConfig: session.snappingConfig,
    });
  }

  clear() {
    if (!this.view) return;
    this.view.webview.postMessage({
      type: "updateElementSettings",
      selectedElements: [],
      properties: [],
      snappingEnabled: true,
      snappingConfig: DEFAULT_SNAPPING_CONFIG,
    });
  }
}
