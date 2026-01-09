import * as vscode from "vscode";

export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "main.js"));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "tailwind.css"));
  const cspSource = webview.cspSource;

  return /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data: blob:; media-src ${cspSource} https: data: blob:; script-src ${cspSource} 'unsafe-inline' 'wasm-unsafe-eval'; style-src ${cspSource} 'unsafe-inline'; font-src ${cspSource}; connect-src ${cspSource} https: http: wss: ws: data: blob:; frame-src blob: data:;" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MML Preview</title>
    <link rel="stylesheet" href="${styleUri}" />
  </head>
  <body class="h-screen w-screen overflow-hidden">
    <div id="__mml_preview_react_root" class="h-screen w-screen overflow-hidden"></div>
    <script src="${scriptUri}"></script>
  </body>
</html>`;
}
