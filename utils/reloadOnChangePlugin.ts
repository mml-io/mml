import * as chokidar from "chokidar";
import * as esbuild from "esbuild";
import * as http from "http";
import { AddressInfo } from "net";
import WebSocket from "ws";
import type { Server as WebSocketServerCtor } from "ws";

const WebSocketServer = (WebSocket as any).Server as typeof WebSocketServerCtor;

/**
 * Creates an esbuild plugin that automatically reloads the page when files change.

 * It starts a WebSocket server on a random port and injects a banner into the JS
 * that connects to this server and reloads the page when changes are detected.
 */
export function reloadOnChangePlugin(
  options: {
    /**
     * Directory to watch for changes
     */
    watchDir?: string;

    /**
     * Explicitly enable/disable the plugin. Default is false.
     */
    enabled?: boolean;
  } = {},
): esbuild.Plugin {
  let wsServer: InstanceType<typeof WebSocketServer> | null = null;
  let httpServer: http.Server | null = null;

  const clients = new Set<WebSocket>();

  return {
    name: "reload-on-change",
    setup: async (build) => {
      if (!(options.enabled ?? false)) {
        return;
      }

      const watchDir =
        options.watchDir || build.initialOptions.outdir || "./build";
      const watcher = chokidar.watch(watchDir, {
        ignored: /(^|[/\\])\../, // Ignore dotfiles
        persistent: true,
      });

      watcher.on("change", (event) => {
        if (clients.size > 0) {
          console.log(
            `[reload-on-change] Change detected, notifying ${clients.size} clients`,
          );
          clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send("reload");
            }
          });
        }
      });

      // Try to create a server on a random port
      const setupServer = async (): Promise<number> => {
        return new Promise((resolve) => {
          httpServer = http.createServer();
          wsServer = new WebSocketServer({ server: httpServer });

          wsServer.on("connection", (client: WebSocket) => {
            clients.add(client);
            client.on("close", () => {
              clients.delete(client);
            });
          });

          httpServer.listen(0, () => {
            const listeningPort = (httpServer!.address() as AddressInfo).port;
            console.log(
              `[reload-on-change] WebSocket change server listening on port ${listeningPort}...`,
            );
            resolve(listeningPort);
          });
        });
      };

      const port = await setupServer();
      console.log("`[reload-on-change] Injecting reload script into build`");

      let existingBanner = build.initialOptions.banner;
      if (!existingBanner) {
        existingBanner = {};
        build.initialOptions.banner = existingBanner;
      }
      const existingJsBanner = existingBanner["js"] || "";
      const bannerJs = `
        (() => {
          let current;
          function connect(reconnecting){
            const ws = new WebSocket((window.location.protocol === "https:" ? "wss://" : "ws://")+window.location.hostname+":"+${port});
            current = ws;
            ws.addEventListener('open',(e)=>{
              if (reconnecting) {
                location.reload();
              }
            });
            ws.addEventListener('error',(e)=>{setTimeout(() => {(ws === current) && connect(true)}, 1000)});
            ws.addEventListener('close',(e)=>{setTimeout(() => {(ws === current) && connect(true)}, 1000)});
            ws.addEventListener('message', () => location.reload());
          }
          connect();
        })();`;
      existingBanner["js"] = `${existingJsBanner}${bannerJs}`;

      // Clean up when build is disposed
      build.onDispose(() => {
        if (wsServer) {
          wsServer.close();
          wsServer = null;
        }
        if (httpServer) {
          httpServer.close();
          httpServer = null;
        }
      });
    },
  };
}