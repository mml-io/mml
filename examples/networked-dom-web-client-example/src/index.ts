import * as fs from "fs";
import * as path from "path";
import * as url from "url";

import { NetworkedDOM } from "@mml-io/networked-dom-document";
import * as chokidar from "chokidar";
import express, { Request } from "express";
import enableWs from "express-ws";
import { EditableNetworkedDOM, LocalObservableDOMFactory } from "networked-dom-server";
import ws from "ws";

const dirname = url.fileURLToPath(new URL(".", import.meta.url));

const port = process.env.PORT || 7071;

const filePath = path.resolve(dirname, "../src/networked-dom-document.html");

const getHTMLFileContents = () => fs.readFileSync(filePath, "utf8");

const getWebsocketUrl = (req: Request) =>
  `${req.secure ? "wss" : "ws"}://${
    req.headers["x-forwarded-host"]
      ? `${req.headers["x-forwarded-host"]}:${req.headers["x-forwarded-port"]}`
      : req.headers.host
  }/networked-dom-websocket`;

const document = new EditableNetworkedDOM(
  url.pathToFileURL(filePath).toString(),
  LocalObservableDOMFactory,
  false,
);
document.load(getHTMLFileContents());
chokidar.watch(filePath).on("change", () => {
  document.load(getHTMLFileContents());
});

const { app } = enableWs(express(), undefined, {
  wsOptions: {
    handleProtocols: NetworkedDOM.handleWebsocketSubprotocol,
  },
});
app.enable("trust proxy");
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
      <p><a href="/websocket-example/">Websocket-based web client live-streaming of HTML (dom.html)</a></p>
      <p><a href="/static-example/">Example HTML File (dom.html) served directly (no websocket).</a></p>
      <p>The websocket address for the document on this server is:</p>
      <div><pre>${getWebsocketUrl(req)}</pre></div>
`);
});
app.get("/static-example/", (req, res) => {
  res.send(getHTMLFileContents());
});
app.ws("/networked-dom-websocket", (ws: ws.WebSocket) => {
  document.addWebSocket(ws as unknown as WebSocket);
  ws.on("close", () => {
    document.removeWebSocket(ws as unknown as WebSocket);
  });
});
app.get("/websocket-example/", (req, res) => {
  res.send(
    `<html><script src="http://localhost:28892/index.js?websocketUrl=${getWebsocketUrl(
      req,
    )}"></script></html>`,
  );
});

console.log("Serving on port:", port);
console.log(`http://localhost:${port}`);
app.listen(port);
