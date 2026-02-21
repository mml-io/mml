import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

import { NetworkedDOM } from "@mml-io/networked-dom-document";
import express, { static as expressStatic } from "express";
import enableWs from "express-ws";

const require = createRequire(import.meta.url);

export function normalizeUrlPath(urlPath: string): string {
  return urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
}

export interface CreateServerOptions {
  client: boolean;
  assets?: string;
  assetsUrlPath: string;
  delay?: boolean;
}

export function createServer(options: CreateServerOptions) {
  const { app } = enableWs(express(), undefined, {
    wsOptions: {
      handleProtocols: NetworkedDOM.handleWebsocketSubprotocol,
    },
  });
  app.enable("trust proxy");

  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
  });

  if (options.delay) {
    app.use((req, _res, next) => {
      const delayParam = req.query.delay;
      if (typeof delayParam === "string") {
        const delayMs = parseInt(delayParam, 10);
        if (!isNaN(delayMs) && delayMs > 0) {
          setTimeout(next, delayMs);
          return;
        }
      }
      next();
    });
  }

  if (options.assets) {
    const assetsPath = path.resolve(options.assets);
    if (!fs.existsSync(assetsPath)) {
      console.error(`Assets directory not found: ${assetsPath}`);
      process.exit(1);
    }
    app.use(normalizeUrlPath(options.assetsUrlPath), expressStatic(assetsPath));
  }

  if (options.client) {
    const clientBuildPath = path.dirname(require.resolve("@mml-io/mml-web-client"));
    app.use("/client/", expressStatic(clientBuildPath));
  }

  return app;
}

export type FileFormat = "html" | "js";

/**
 * Detects the file format from the file extension. Returns null for
 * unrecognised extensions.
 */
export function detectFormat(filePath: string): FileFormat | null {
  if (filePath.endsWith(".js")) return "js";
  if (filePath.endsWith(".html") || filePath.endsWith(".htm")) return "html";
  return null;
}

/**
 * Wraps raw JS file contents in an HTML body/script tag pair. Returns HTML
 * contents unchanged.
 */
export function fileContentsToHtml(raw: string, format: FileFormat): string {
  if (format !== "js") return raw;
  // Escape </script so the HTML parser doesn't close the tag early
  const escaped = raw.replace(/<\/(script)/gi, "<\\/$1");
  return `<body><script>\n${escaped}\n</script></body>`;
}

/**
 * Returns an HTML page that loads the MML web client, connecting to a WebSocket
 * URL derived client-side from window.location to avoid header injection.
 */
export function clientPage(wsPath: string, defineGlobals: boolean = false): string {
  // Escape < to \u003c to prevent </script> from closing the tag early
  const safePath = JSON.stringify(wsPath).replace(/</g, "\\u003c");
  const defineGlobalsParam = defineGlobals ? "defineGlobals=true&" : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body><script>
(function() {
  var p = location.protocol === "https:" ? "wss:" : "ws:";
  var s = document.createElement("script");
  s.src = "/client/index.js?${defineGlobalsParam}url=" + encodeURIComponent(p + "//" + location.host + ${safePath});
  document.body.appendChild(s);
})();
</script></body>
</html>`;
}
