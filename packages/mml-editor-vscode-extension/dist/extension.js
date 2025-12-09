"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"));

// src/webview/html.ts
var vscode = __toESM(require("vscode"));
function getWebviewHtml(webview, extensionUri) {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "webview.js"));
  const cspSource = webview.cspSource;
  return (
    /* html */
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data: blob:; media-src ${cspSource} https: data: blob:; script-src ${cspSource} 'unsafe-inline' 'wasm-unsafe-eval'; style-src ${cspSource} 'unsafe-inline'; font-src ${cspSource}; connect-src ${cspSource} https: http: wss: ws: data: blob:; frame-src blob: data:;" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MML Preview</title>
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        padding: 0;
        background: #0a0a0a;
        color: #cdd5e0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        height: 100vh;
        overflow: hidden;
      }
      #frame {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
      }
      #toolbar {
        height: 36px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.02);
        font-size: 12px;
        letter-spacing: 0.02em;
        user-select: none;
      }
      #status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #f97316;
        box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.15);
      }
      #status-dot.ready {
        background: #22c55e;
        box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.15);
      }
      #filename {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #preview-root {
        position: relative;
        flex: 1;
        min-height: 0;
        background: black;
      }
      #overlay {
        position: absolute;
        top: 10px;
        right: 12px;
        background: rgba(0, 0, 0, 0.65);
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 11px;
        color: #9ca3af;
        pointer-events: none;
      }
    </style>
  </head>
  <body>
    <div id="frame">
      <div id="toolbar">
        <div id="status-dot"></div>
        <div id="filename">Waiting for editor...</div>
        <div id="overlay">Powered by mml-editor preview</div>
      </div>
      <div id="preview-root"></div>
    </div>
    <script src="${scriptUri}"></script>
  </body>
</html>`
  );
}

// src/extension.ts
var COMMAND_ID = "mml.preview";
function activate(context) {
  const openPreview = vscode2.commands.registerCommand(COMMAND_ID, () => {
    const activeEditor = vscode2.window.activeTextEditor;
    if (!activeEditor) {
      vscode2.window.showWarningMessage("Open an MML document in the editor first.");
      return;
    }
    createOrRevealPreview(context, activeEditor.document);
  });
  context.subscriptions.push(openPreview);
}
function deactivate() {
}
var session = null;
function createOrRevealPreview(context, initialDoc) {
  if (session?.panel) {
    session.panel.reveal();
    session.trackedDocument = initialDoc;
    pushDocumentContent(session, initialDoc, true);
    return;
  }
  const panel = vscode2.window.createWebviewPanel(
    "mmlPreview",
    "MML Preview",
    vscode2.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode2.Uri.joinPath(context.extensionUri, "dist")]
    }
  );
  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);
  const disposables = [];
  const selectionDecoration = vscode2.window.createTextEditorDecorationType({
    backgroundColor: "rgba(255, 215, 0, 0.25)",
    border: "1px solid rgba(255, 185, 0, 0.6)"
  });
  const newSession = {
    panel,
    trackedDocument: initialDoc,
    disposables,
    pendingUpdate: null,
    suppressChangeCount: 0,
    selectionDecoration,
    lastSelectionRanges: [],
    lastSelectionUri: initialDoc.uri.toString()
  };
  session = newSession;
  disposables.push(
    panel.onDidDispose(() => {
      disposables.forEach((d) => d.dispose());
      session = null;
    })
  );
  disposables.push(selectionDecoration);
  disposables.push(
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message?.type === "ready") {
        pushDocumentContent(newSession, newSession.trackedDocument, true);
      }
      if (message?.type === "updateContent" && typeof message.content === "string") {
        await applyWebviewContentUpdate(newSession, message.content, message.uri);
      }
      if (message?.type === "selectionChange" && Array.isArray(message.ranges)) {
        applySelectionHighlight(newSession, message.ranges, message.uri);
      }
    })
  );
  disposables.push(
    vscode2.workspace.onDidChangeTextDocument((event) => {
      if (!session || event.document.uri.toString() !== session.trackedDocument.uri.toString()) {
        return;
      }
      if (session.suppressChangeCount > 0) {
        session.suppressChangeCount -= 1;
        return;
      }
      schedulePush(session, event.document);
    })
  );
  disposables.push(
    vscode2.window.onDidChangeActiveTextEditor((editor) => {
      if (!session || !editor)
        return;
      session.trackedDocument = editor.document;
      pushDocumentContent(session, editor.document, true);
    })
  );
  pushDocumentContent(newSession, initialDoc, true);
}
function schedulePush(currentSession, doc) {
  if (currentSession.pendingUpdate) {
    clearTimeout(currentSession.pendingUpdate);
  }
  currentSession.pendingUpdate = setTimeout(() => {
    pushDocumentContent(currentSession, doc, false);
    currentSession.pendingUpdate = null;
  }, 150);
}
function pushDocumentContent(currentSession, doc, force) {
  const text = doc.getText();
  const uri = doc.uri.toString();
  const fileName = doc.uri.scheme === "file" ? doc.uri.path.split("/").pop() ?? doc.uri.toString() : uri;
  currentSession.panel.webview.postMessage({
    type: "setContent",
    content: text,
    uri,
    fileName,
    force
  });
}
async function applyWebviewContentUpdate(currentSession, newContent, sourceUri) {
  const doc = currentSession.trackedDocument;
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
  const edit = new vscode2.WorkspaceEdit();
  const fullRange = new vscode2.Range(doc.positionAt(0), doc.positionAt(existing.length));
  edit.replace(doc.uri, fullRange, newContent);
  currentSession.suppressChangeCount += 1;
  const success = await vscode2.workspace.applyEdit(edit);
  if (!success) {
    currentSession.suppressChangeCount = Math.max(0, currentSession.suppressChangeCount - 1);
    return;
  }
  if (currentSession.lastSelectionRanges.length > 0) {
    applySelectionHighlight(
      currentSession,
      currentSession.lastSelectionRanges,
      currentSession.lastSelectionUri
    );
  }
}
function applySelectionHighlight(currentSession, ranges, sourceUri) {
  const doc = currentSession.trackedDocument;
  if (!doc || doc.isClosed) {
    return;
  }
  const docUri = doc.uri.toString();
  if (sourceUri && docUri !== sourceUri) {
    return;
  }
  currentSession.lastSelectionRanges = ranges;
  currentSession.lastSelectionUri = sourceUri ?? docUri;
  const text = doc.getText();
  const textLength = text.length;
  const targetEditors = vscode2.window.visibleTextEditors.filter(
    (editor) => editor.document.uri.toString() === docUri
  );
  const vscodeRanges = ranges.map((range) => {
    const startPos = doc.positionAt(Math.max(0, Math.min(range.start, textLength)));
    const endPos = doc.positionAt(Math.max(0, Math.min(range.end, textLength)));
    return new vscode2.Range(startPos, endPos);
  });
  targetEditors.forEach((editor) => {
    editor.setDecorations(currentSession.selectionDecoration, vscodeRanges);
    if (vscodeRanges[0]) {
      editor.revealRange(vscodeRanges[0], vscode2.TextEditorRevealType.InCenter);
    }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
