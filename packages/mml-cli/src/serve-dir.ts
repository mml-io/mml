import { type Stats } from "node:fs";
import * as fs from "node:fs";
import * as path from "node:path";
import * as QueryString from "node:querystring";
import * as url from "node:url";

import { EditableNetworkedDOM, LocalObservableDOMFactory } from "@mml-io/networked-dom-server";
import * as chokidar from "chokidar";
import picomatch from "picomatch";

import {
  clientPage,
  createServer,
  detectFormat,
  fileContentsToHtml,
  normalizeUrlPath,
} from "./server.js";

export interface ServeDirOptions {
  port: number;
  host: string;
  client: boolean;
  pattern?: string;
  assets?: string;
  assetsUrlPath: string;
  idleTimeout: number;
  reset: boolean;
  defineGlobals: boolean;
  delay: boolean;
}

type DocumentEntry = {
  documentPath: string;
  documentUrl: string;
  document: EditableNetworkedDOM | null;
  contents: string;
  connectionCount: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
  stopsAt: number | null;
};

function ensureDocumentLoaded(
  documents: Record<string, DocumentEntry>,
  filename: string,
): EditableNetworkedDOM | null {
  const docData = documents[filename];
  if (!docData) {
    return null;
  }
  if (!docData.document) {
    console.log(`Loading document ${filename}`);
    docData.document = new EditableNetworkedDOM(
      docData.documentUrl,
      LocalObservableDOMFactory,
      false,
    );
    docData.document.load(docData.contents);
  }
  return docData.document;
}

function onConnectionAdded(docData: DocumentEntry): void {
  docData.connectionCount++;
  if (docData.idleTimer !== null) {
    clearTimeout(docData.idleTimer);
    docData.idleTimer = null;
    docData.stopsAt = null;
  }
}

function onConnectionRemoved(docData: DocumentEntry, idleTimeout: number): void {
  docData.connectionCount--;
  if (docData.connectionCount === 0 && idleTimeout > 0) {
    docData.stopsAt = Date.now() + idleTimeout * 1000;
    docData.idleTimer = setTimeout(() => {
      docData.idleTimer = null;
      docData.stopsAt = null;
      console.log(`Stopping document ${docData.documentPath} due to no connections`);
      if (docData.document) {
        docData.document.dispose();
        docData.document = null;
      }
    }, idleTimeout * 1000);
  }
}

export function serveDir(dir: string, options: ServeDirOptions): void {
  const dirPath = path.resolve(dir);

  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    console.error(`Directory not found: ${dirPath}`);
    process.exit(1);
  }

  const documents: Record<string, DocumentEntry> = {};
  const isPatternMatch = options.pattern ? picomatch(options.pattern) : null;

  const watcher = chokidar.watch(dirPath, {
    ignored: (filePath: string, stats?: Stats) => {
      if (!stats?.isFile()) return false;
      if (!filePath.endsWith(".html") && !filePath.endsWith(".htm") && !filePath.endsWith(".js"))
        return true;
      if (isPatternMatch) {
        return !isPatternMatch(path.basename(filePath));
      }
      return false;
    },
    depth: 0,
    persistent: true,
  });

  watcher
    .on("add", (filePath) => {
      const filename = path.basename(filePath);
      const format = detectFormat(filePath);
      if (!format) return;
      console.log(`Document added: ${filename}`);
      const contents = fileContentsToHtml(fs.readFileSync(filePath, "utf8"), format);
      documents[filename] = {
        documentPath: filename,
        documentUrl: url.pathToFileURL(filePath).toString(),
        document: null,
        contents,
        connectionCount: 0,
        idleTimer: null,
        stopsAt: null,
      };
    })
    .on("change", (filePath) => {
      const filename = path.basename(filePath);
      const format = detectFormat(filePath);
      if (!format) return;
      console.log(`Document changed: ${filename}`);
      const contents = fileContentsToHtml(fs.readFileSync(filePath, "utf8"), format);
      const docData = documents[filename];
      if (docData) {
        docData.contents = contents;
        if (docData.document) {
          docData.document.load(contents);
        }
      }
    })
    .on("unlink", (filePath) => {
      const filename = path.basename(filePath);
      console.log(`Document removed: ${filename}`);
      const docData = documents[filename];
      if (docData) {
        if (docData.idleTimer !== null) {
          clearTimeout(docData.idleTimer);
        }
        if (docData.document) {
          docData.document.dispose();
        }
        delete documents[filename];
      }
    })
    .on("error", (error) => {
      console.error("Error watching directory:", error);
    });

  const app = createServer({
    client: options.client,
    assets: options.assets,
    assetsUrlPath: options.assetsUrlPath,
    delay: options.delay,
  });

  app.get("/", (_req, res) => {
    const docInfos = Object.values(documents)
      .sort((a, b) => a.documentPath.localeCompare(b.documentPath))
      .map(({ documentPath, document, connectionCount, stopsAt }) => ({
        path: documentPath,
        running: document !== null,
        connections: connectionCount,
        stopsAt,
      }));
    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>MML Documents</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #ddd; }
  td { padding: 8px 12px; border-bottom: 1px solid #eee; }
  a { color: #0366d6; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 13px; user-select: all; }
  .copy-btn { border: 1px solid #ccc; background: #fafafa; border-radius: 3px; padding: 2px 8px; cursor: pointer; font-size: 12px; margin-left: 6px; }
  .copy-btn:hover { background: #eee; }
  .empty { color: #888; }
  .status { font-size: 13px; }
  .status-running { color: #22863a; }
  .status-idle { color: #b08800; }
  .status-stopped { color: #888; }
</style>
</head>
<body>
  <h1>MML Documents</h1>
  <div id="root"></div>
  <script>
    var docs = ${JSON.stringify(docInfos).replace(/</g, "\\u003c")};
    var wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
    var root = document.getElementById("root");
    function el(tag, className) {
      var e = document.createElement(tag);
      if (className) e.className = className;
      return e;
    }
    var countdownEls = [];
    function updateCountdown(span, stopsAt) {
      var secs = Math.max(0, Math.ceil((stopsAt - Date.now()) / 1000));
      span.textContent = "Idle, stopping in " + secs + "s";
    }
    if (docs.length === 0) {
      var p = el("p", "empty");
      p.textContent = "No documents found.";
      root.appendChild(p);
    } else {
      var table = el("table");
      var thead = el("thead");
      var headerRow = el("tr");
      ["Document", "Status", "WebSocket URL"].forEach(function(text) {
        var th = el("th");
        th.textContent = text;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
      var tbody = el("tbody");
      docs.forEach(function(doc) {
        var wsUrl = wsProtocol + "//" + location.host + "/" + doc.path;
        var tr = el("tr");
        var tdName = el("td");
        var link = el("a");
        link.href = "/" + encodeURIComponent(doc.path) + "/";
        link.textContent = doc.path;
        tdName.appendChild(link);
        tr.appendChild(tdName);
        var tdStatus = el("td");
        var status;
        if (doc.running && doc.stopsAt) {
          status = el("span", "status status-idle");
          status.setAttribute("data-stops-at", doc.stopsAt);
          updateCountdown(status, doc.stopsAt);
          countdownEls.push(status);
        } else if (doc.running) {
          status = el("span", "status status-running");
          status.textContent = "Running (" + doc.connections + " " + (doc.connections === 1 ? "connection" : "connections") + ")";
        } else {
          status = el("span", "status status-stopped");
          status.textContent = "Stopped";
        }
        tdStatus.appendChild(status);
        tr.appendChild(tdStatus);
        var tdWs = el("td");
        var code = el("code");
        code.textContent = wsUrl;
        tdWs.appendChild(code);
        var btn = el("button", "copy-btn");
        btn.textContent = "Copy";
        btn.addEventListener("click", function() {
          navigator.clipboard.writeText(wsUrl);
          btn.textContent = "Copied";
          setTimeout(function() { btn.textContent = "Copy"; }, 1500);
        });
        tdWs.appendChild(btn);
        tr.appendChild(tdWs);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      root.appendChild(table);
      if (countdownEls.length > 0) {
        setInterval(function() {
          countdownEls.forEach(function(span) {
            updateCountdown(span, Number(span.getAttribute("data-stops-at")));
          });
        }, 1000);
      }
    }
  </script>
</body>
</html>`);
  });

  app.ws("/:documentPath", (ws, req) => {
    const documentPath = req.params.documentPath as string;
    const docData = documents[documentPath];
    if (!docData) {
      ws.close();
      return;
    }
    onConnectionAdded(docData);
    const currentDocument = ensureDocumentLoaded(documents, documentPath);
    if (!currentDocument) {
      ws.close();
      return;
    }
    currentDocument.addWebSocket(ws as unknown as WebSocket);
    ws.on("close", () => {
      if (documents[documentPath] === docData) {
        currentDocument.removeWebSocket(ws as unknown as WebSocket);
        onConnectionRemoved(docData, options.idleTimeout);
      }
    });
  });

  if (options.reset) {
    app.get("/:documentPath/reset", (req, res) => {
      const documentPath = req.params.documentPath as string;
      const wasAlreadyLoaded = documents[documentPath]?.document !== null;
      const currentDocument = ensureDocumentLoaded(documents, documentPath);
      if (!currentDocument) {
        res.status(404).send(`Document not found: ${documentPath}`);
        return;
      }
      if (wasAlreadyLoaded) {
        currentDocument.reload();
      }
      const queryString = QueryString.encode(req.query as QueryString.ParsedUrlQueryInput);
      res.redirect(`/${documentPath}/${queryString ? `?${queryString}` : ""}`);
    });
  }

  if (options.client) {
    app.get("/:documentPath/", (req, res) => {
      const documentPath = req.params.documentPath as string;
      if (!documents[documentPath]) {
        res.status(404).send(`Document not found: ${documentPath}`);
        return;
      }
      res.send(clientPage(`/${documentPath}`, options.defineGlobals));
    });
  }

  app.listen(options.port, options.host, () => {
    console.log(`Serving directory ${dirPath}`);
    console.log(`http://${options.host}:${options.port}`);
    if (options.assets) {
      console.log(
        `Assets served at http://${options.host}:${options.port}${normalizeUrlPath(options.assetsUrlPath)}`,
      );
    }
    console.log("Watching for file changes...");
  });
}
