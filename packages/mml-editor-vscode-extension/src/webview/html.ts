import * as vscode from "vscode";

export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "webview.js"));
  const cspSource = webview.cspSource;

  // Note: We use 'unsafe-inline' without a nonce because the IframeObservableDOMFactory
  // creates srcdoc iframes with inline scripts. When a nonce is present, 'unsafe-inline'
  // is ignored, and srcdoc content cannot easily include the nonce.
  return /* html */ `<!DOCTYPE html>
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
</html>`;
}
