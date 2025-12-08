import * as vscode from "vscode";

import { getWebviewHtml } from "./webview/html";

type PreviewSession = {
  panel: vscode.WebviewPanel;
  trackedDocument: vscode.TextDocument;
  disposables: vscode.Disposable[];
  pendingUpdate: ReturnType<typeof setTimeout> | null;
  suppressChangeCount: number;
};

const COMMAND_ID = "mml.preview";

export function activate(context: vscode.ExtensionContext) {
  const openPreview = vscode.commands.registerCommand(COMMAND_ID, () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showWarningMessage("Open an MML document in the editor first.");
      return;
    }

    createOrRevealPreview(context, activeEditor.document);
  });

  context.subscriptions.push(openPreview);
}

export function deactivate() {
  // Nothing to clean up beyond panel disposables
}

let session: PreviewSession | null = null;

function createOrRevealPreview(context: vscode.ExtensionContext, initialDoc: vscode.TextDocument) {
  if (session?.panel) {
    session.panel.reveal();
    session.trackedDocument = initialDoc;
    pushDocumentContent(session, initialDoc, true);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "mmlPreview",
    "MML Preview",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist")],
    },
  );

  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

  const disposables: vscode.Disposable[] = [];

  const newSession: PreviewSession = {
    panel,
    trackedDocument: initialDoc,
    disposables,
    pendingUpdate: null,
    suppressChangeCount: 0,
  };
  session = newSession;

  disposables.push(
    panel.onDidDispose(() => {
      disposables.forEach((d) => d.dispose());
      session = null;
    }),
  );

  disposables.push(
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message?.type === "ready") {
        pushDocumentContent(newSession, newSession.trackedDocument, true);
      }
      if (message?.type === "updateContent" && typeof message.content === "string") {
        await applyWebviewContentUpdate(newSession, message.content, message.uri);
      }
    }),
  );

  disposables.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (!session || event.document.uri.toString() !== session.trackedDocument.uri.toString()) {
        return;
      }
      if (session.suppressChangeCount > 0) {
        session.suppressChangeCount -= 1;
        return;
      }
      schedulePush(session, event.document);
    }),
  );

  disposables.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!session || !editor) return;
      session.trackedDocument = editor.document;
      pushDocumentContent(session, editor.document, true);
    }),
  );

  // Initial content
  pushDocumentContent(newSession, initialDoc, true);
}

function schedulePush(currentSession: PreviewSession, doc: vscode.TextDocument) {
  if (currentSession.pendingUpdate) {
    clearTimeout(currentSession.pendingUpdate);
  }
  currentSession.pendingUpdate = setTimeout(() => {
    pushDocumentContent(currentSession, doc, false);
    currentSession.pendingUpdate = null;
  }, 150);
}

function pushDocumentContent(currentSession: PreviewSession, doc: vscode.TextDocument, force: boolean) {
  const text = doc.getText();
  const uri = doc.uri.toString();
  const fileName = doc.uri.scheme === "file" ? doc.uri.path.split("/").pop() ?? doc.uri.toString() : uri;

  currentSession.panel.webview.postMessage({
    type: "setContent",
    content: text,
    uri,
    fileName,
    force,
  });
}

async function applyWebviewContentUpdate(
  currentSession: PreviewSession,
  newContent: string,
  sourceUri?: string,
) {
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

  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(existing.length));
  edit.replace(doc.uri, fullRange, newContent);
  currentSession.suppressChangeCount += 1;
  const success = await vscode.workspace.applyEdit(edit);
  if (!success) {
    currentSession.suppressChangeCount = Math.max(0, currentSession.suppressChangeCount - 1);
  }
}

