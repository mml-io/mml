import { Stats } from "node:fs";
import * as QueryString from "node:querystring";

import { EditableNetworkedDOM, LocalObservableDOMFactory } from "@mml-io/networked-dom-server";
import * as chokidar from "chokidar";
import express, { Request, static as expressStatic } from "express";
import enableWs from "express-ws";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";

const port = process.env.PORT || 7079;

const dirname = url.fileURLToPath(new URL(".", import.meta.url));
const srcPath = path.resolve(dirname, "../src");

const documents: {
  [key: string]: {
    documentPath: string;
    document: EditableNetworkedDOM;
    contents: string;
    loaded: boolean;
  };
} = {};

// Lazy load a document on first access
const ensureDocumentLoaded = (filename: string) => {
  const docData = documents[filename];
  if (!docData) {
    return null;
  }

  if (!docData.loaded) {
    console.log("Loading document", filename, "on first access");
    docData.document.load(docData.contents);
    docData.loaded = true;
  }

  return docData.document;
};

const watcher = chokidar.watch(srcPath, {
  ignored: (path: string, stats: Stats) => (stats?.isFile() || false) && !path.endsWith(".html"),
  depth: 0,
  persistent: true,
});
watcher
  .on("add", (relativeFilePath) => {
    const filename = path.basename(relativeFilePath);
    console.log("File", filename, "has been added (lazy loading)");
    const contents = fs.readFileSync(relativeFilePath, { encoding: "utf8", flag: "r" });
    const document = new EditableNetworkedDOM(
      url.pathToFileURL(filename).toString(),
      LocalObservableDOMFactory,
      false,
    );
    // Don't load contents immediately - wait for first access

    const currentData = {
      documentPath: filename,
      document,
      contents,
      loaded: false,
    };
    documents[filename] = currentData;
  })
  .on("change", (relativeFilePath) => {
    const filename = path.basename(relativeFilePath);
    console.log("File", filename, "has been changed");
    const contents = fs.readFileSync(relativeFilePath, { encoding: "utf8", flag: "r" });
    const docData = documents[filename];
    if (docData) {
      docData.contents = contents;
      // Only reload if document was already loaded
      if (docData.loaded) {
        console.log("Reloading already-loaded document", filename);
        docData.document.load(contents);
      }
    }
  })
  .on("unlink", (relativeFilePath) => {
    const filename = path.basename(relativeFilePath);
    console.log("File", filename, "has been removed");
    const document = documents[filename].document;
    document.dispose();
    delete documents[filename];
  })
  .on("error", (error) => {
    console.error("Error whilst watching directory", error);
  });

const getWebsocketUrl = (req: Request) =>
  `${req.secure ? "wss" : "ws"}://${
    req.headers["x-forwarded-host"]
      ? `${req.headers["x-forwarded-host"]}:${req.headers["x-forwarded-port"]}`
      : req.headers.host
  }/${req.params.documentPath}`;

const { app } = enableWs(express());
app.enable("trust proxy");

// Allow all origins
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

// Delay middleware - checks for delay query parameter
app.use((req, res, next) => {
  const delayParam = req.query.delay;
  if (delayParam) {
    const delayMs = parseInt(delayParam as string, 10);
    if (!isNaN(delayMs) && delayMs > 0) {
      console.log(`Delaying request by ${delayMs}ms`);
      setTimeout(() => {
        next();
      }, delayMs);
      return;
    }
  }
  next();
});

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      ${Object.values(documents)
        .map(({ documentPath }) => `<p><a href="/${documentPath}">${documentPath}</a></p>`)
        .join("")}
`);
});

app.use("/assets", expressStatic("./src/assets"));

app.ws("/:pathName", (ws, req) => {
  const { pathName } = req.params;

  const currentDocument = ensureDocumentLoaded(pathName);

  if (!currentDocument) {
    ws.close();
    return;
  }

  currentDocument.addWebSocket(ws as unknown as WebSocket);
  ws.on("close", () => {
    currentDocument.removeWebSocket(ws as unknown as WebSocket);
  });
});

app.get("/:documentPath/", (req, res) => {
  const { documentPath } = req.params;

  // Ensure document exists (but don't necessarily load it yet)
  if (!documents[documentPath]) {
    res.status(404).send(`Document not found: ${documentPath}`);
    return;
  }

  const html = `<html><script src="${req.secure ? "https" : "http"}://${req.get(
    "host",
  )}/client/index.js?defineGlobals=true&url=${getWebsocketUrl(req)}"></script></html>`;

  res.send(html);
});

app.use(
  "/client/",
  expressStatic(path.resolve(dirname, "../../node_modules/@mml-io/mml-web-client/build/")),
);

app.get("/:documentPath/reset", (req, res) => {
  const { documentPath } = req.params;

  const currentDocument = ensureDocumentLoaded(documentPath);

  if (!currentDocument) {
    res.status(404).send(`Document not found: ${documentPath}`);
    return;
  }

  const queryString = QueryString.encode(req.query as QueryString.ParsedUrlQueryInput);

  currentDocument.reload();
  res.redirect("/" + documentPath + "?" + queryString);
});

console.log("Serving on port:", port);
console.log(`http://localhost:${port}`);
app.listen(port);
