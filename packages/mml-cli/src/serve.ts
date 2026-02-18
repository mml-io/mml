import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { EditableNetworkedDOM, LocalObservableDOMFactory } from "@mml-io/networked-dom-server";
import * as chokidar from "chokidar";

import { clientPage, createServer, normalizeUrlPath } from "./server.js";

export interface ServeOptions {
  port: number;
  host: string;
  watch: boolean;
  client: boolean;
  assets?: string;
  assetsUrlPath: string;
}

export function serve(file: string, options: ServeOptions): void {
  const filePath = path.resolve(file);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const getHTMLFileContents = () => fs.readFileSync(filePath, "utf8");

  const document = new EditableNetworkedDOM(
    url.pathToFileURL(filePath).toString(),
    LocalObservableDOMFactory,
    false,
  );
  document.load(getHTMLFileContents());

  if (options.watch) {
    chokidar.watch(filePath).on("change", () => {
      console.log("File changed, reloading...");
      document.load(getHTMLFileContents());
    });
  }

  const cleanup = () => {
    document.dispose();
    process.exit();
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  const app = createServer(options);

  app.ws("/ws", (ws) => {
    document.addWebSocket(ws as unknown as WebSocket);
    ws.on("close", () => {
      document.removeWebSocket(ws as unknown as WebSocket);
    });
  });

  if (options.client) {
    app.get("/", (_req, res) => {
      res.send(clientPage("/ws"));
    });
  }

  app.listen(options.port, options.host, () => {
    console.log(`Serving ${filePath}`);
    console.log(`WebSocket url: ws://${options.host}:${options.port}/ws`);
    if (options.client) {
      console.log(`Client url: http://${options.host}:${options.port}`);
    }
    if (options.assets) {
      console.log(
        `Assets served at http://${options.host}:${options.port}${normalizeUrlPath(options.assetsUrlPath)}`,
      );
    }
    if (options.watch) {
      console.log("Watching for file changes...");
    }
  });
}
