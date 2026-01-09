import * as vscode from "vscode";

function createSidebarHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  scriptName: string,
  title: string,
): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", scriptName));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "tailwind.css"));
  const cspSource = webview.cspSource;

  return /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource} 'unsafe-inline'; style-src ${cspSource} 'unsafe-inline';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="${styleUri}" />
  </head>
  <body class="h-screen w-screen overflow-hidden bg-[var(--color-panel)] text-[var(--color-text)]">
    <div id="root" class="h-full w-full overflow-auto"></div>
    <script src="${scriptUri}"></script>
  </body>
</html>`;
}

export function getSceneOutlineHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  return createSidebarHtml(webview, extensionUri, "sceneSidebar.js", "MML Scene");
}

export function getElementSettingsHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  return createSidebarHtml(webview, extensionUri, "elementSidebar.js", "MML Element");
}
