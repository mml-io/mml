import * as vscode from "vscode";

export function getGlbViewerHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "glbViewerEntry.js"),
  );
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "tailwind.css"));
  const cspSource = webview.cspSource;

  return /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data: blob:; script-src ${cspSource} 'unsafe-inline' 'wasm-unsafe-eval'; style-src ${cspSource} 'unsafe-inline'; font-src ${cspSource}; connect-src ${cspSource} https: http: wss: ws: data: blob:;" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GLB Viewer</title>
    <link rel="stylesheet" href="${styleUri}" />
  </head>
  <body class="h-screen w-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
    <div id="__glb_viewer_root" class="h-full w-full overflow-hidden"></div>
    <script src="${scriptUri}"></script>
  </body>
</html>`;
}
