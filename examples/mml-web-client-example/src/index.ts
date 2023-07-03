import * as fs from "fs";
import * as path from "path";
import * as url from "url";

import { NetworkedDOM } from "@mml-io/networked-dom-document";
import * as chokidar from "chokidar";
import express, { Request } from "express";
import enableWs from "express-ws";
import { EditableNetworkedDOM, LocalObservableDOMFactory } from "networked-dom-server";
import ws from "ws";

const port = process.env.PORT || 8080;

const filePath = path.resolve(__dirname, "../src/mml-document.html");

const getMMLFileContents = () => fs.readFileSync(filePath, "utf8");

const getWebsocketUrl = (req: Request) =>
  `${req.secure ? "wss" : "ws"}://${
    req.headers["x-forwarded-host"]
      ? `${req.headers["x-forwarded-host"]}:${req.headers["x-forwarded-port"]}`
      : req.headers.host
  }/mml-websocket`;

const document = new EditableNetworkedDOM(
  url.pathToFileURL(filePath).toString(),
  LocalObservableDOMFactory,
);
document.load(getMMLFileContents());
chokidar.watch(filePath).on("change", () => {
  document.load(getMMLFileContents());
});

const { app } = enableWs(express(), undefined, {
  wsOptions: {
    handleProtocols: NetworkedDOM.handleWebsocketSubprotocol,
  },
});
app.enable("trust proxy");

// Allow all origins
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
      <p><a href="/websocket-example/">Websocket-based web client live-streaming document</a></p>
      <p><a href="/static-example/">Example MML File (dom.html) prepended by the standalone script</a></p>
      <p>The websocket address for the document on this server is:</p>
      <div><pre>${getWebsocketUrl(req)}</pre></div>
`);
});
app.get("/static-example/", (req, res) => {
  res.send(
    `<html><script src="http://localhost:28891/index.js"></script>${getMMLFileContents()}</html>`,
  );
});
app.ws("/mml-websocket", (ws: ws.WebSocket) => {
  document.addWebSocket(ws as unknown as WebSocket);
  ws.on("close", () => {
    document.removeWebSocket(ws as unknown as WebSocket);
  });
});
app.get("/websocket-example/", (req, res) => {
  res.send(
    `<html><script src="http://localhost:28891/index.js?websocketUrl=${getWebsocketUrl(
      req,
    )}"></script></html>`,
  );
});

console.log("Serving on port:", port);
console.log(`http://localhost:${port}`);
app.listen(port);
