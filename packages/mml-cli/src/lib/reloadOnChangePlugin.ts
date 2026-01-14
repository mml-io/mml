import * as chokidar from "chokidar";
import * as esbuild from "esbuild";
import * as http from "http";
import { AddressInfo } from "net";
import { WebSocket, WebSocketServer } from "ws";

/**
 * Creates an esbuild plugin that automatically reloads the page when files change.
 * It starts a WebSocket server on a random port and injects a banner into the JS
 * that connects to this server and reloads the page when changes are detected.
 */
export function reloadOnChangePlugin(options: {
  /**
   * Directory to watch for changes
   */
  watchDir?: string;

  /**
   * Directories/files to watch for changes (in addition to watchDir).
   */
  watchDirs?: string[];

  /**
   * Explicitly enable/disable the plugin. Default is false.
   */
  enabled?: boolean;

  /**
   * Enable verbose logging. Default is true.
   */
  log?: boolean;
}): esbuild.Plugin {
  let wsServer: WebSocketServer | null = null;
  let httpServer: http.Server | null = null;
  let watcher: chokidar.FSWatcher | null = null;

  const clients = new Set<WebSocket>();

  return {
    name: "reload-on-change",
    setup: async (build) => {
      if (!(options.enabled ?? false)) {
        return;
      }

      const logEnabled = options.log ?? true;
      const log = (message: string) => {
        if (logEnabled) {
          console.log(`[reload-on-change] ${message}`);
        }
      };

      const watchDir = options.watchDir || build.initialOptions.outdir || "./build";
      const watchDirs = options.watchDirs ?? [];
      const watchTargets = [watchDir, ...watchDirs].filter(Boolean);

      let pendingReason: string | null = null;
      let reloadTimer: NodeJS.Timeout | null = null;

      const broadcastReload = (reason: string) => {
        const openClients = [...clients].filter((c) => c.readyState === WebSocket.OPEN);
        log(`reload (${reason}) -> notifying ${openClients.length} clients`);
        openClients.forEach((client) => client.send("reload"));
      };

      const scheduleReload = (reason: string) => {
        pendingReason = reason;
        if (reloadTimer) {
          return;
        }
        reloadTimer = setTimeout(() => {
          reloadTimer = null;
          const r = pendingReason ?? "change";
          pendingReason = null;
          broadcastReload(r);
        }, 75);
      };

      watcher = chokidar.watch(watchTargets, {
        ignored: /(^|[/\\])\../, // Ignore dotfiles
        persistent: true,
        ignoreInitial: true,
      });

      watcher.on("all", (event, changedPath) => {
        log(`${event}: ${changedPath}`);
        scheduleReload(`${event}: ${changedPath}`);
      });

      // Try to create a server on a random port
      const setupServer = async (): Promise<number> => {
        return new Promise((resolve) => {
          httpServer = http.createServer();
          wsServer = new WebSocketServer({ server: httpServer });

          wsServer.on("connection", (client: WebSocket, req) => {
            clients.add(client);
            log(`client connected (${req.socket.remoteAddress ?? "unknown"})`);
            client.on("close", () => {
              clients.delete(client);
              log(`client disconnected (clients=${clients.size})`);
            });
          });

          httpServer.listen(0, "0.0.0.0", () => {
            const listeningPort = (httpServer!.address() as AddressInfo).port;
            log(`WebSocket server listening on port ${listeningPort}`);
            resolve(listeningPort);
          });
        });
      };

      const port = await setupServer();
      log("injecting reload script into JS bundle");

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
            // This script often runs inside an iframe using srcdoc (about:srcdoc),
            // where window.location.hostname is empty and accessing window.parent.location
            // can throw a SecurityError. Instead, fall back to document.referrer.
            function getHttpLikeProtocol(p) {
              return (p === "https:" || p === "http:") ? p : null;
            }
            let protocol = getHttpLikeProtocol(window.location && window.location.protocol);
            let rawHost = (window.location && window.location.hostname) ? window.location.hostname : "";
            if (!rawHost || !protocol) {
              try {
                if (document && document.referrer) {
                  var u = new URL(document.referrer);
                  protocol = protocol || getHttpLikeProtocol(u.protocol) || "http:";
                  rawHost = rawHost || u.hostname || "";
                }
              } catch {}
            }
            protocol = protocol || "http:";

            // Browsing to http://0.0.0.0:<port>/ is common when binding to 0.0.0.0,
            // but 0.0.0.0 is not a real destination host for websocket connections in many browsers.
            const host = (rawHost === "0.0.0.0" || rawHost === "" ? "localhost" : rawHost);
            const proto = (protocol === "https:" ? "wss://" : "ws://");
            const url = proto + host + ":" + ${port};
            try { console.log("[reload-on-change] connecting to", url); } catch {}
            const ws = new WebSocket(url);
            current = ws;
            ws.addEventListener('open',(e)=>{
              try { console.log("[reload-on-change] connected"); } catch {}
              if (reconnecting) {
                location.reload();
              }
            });
            ws.addEventListener('error',(e)=>{ try { console.warn("[reload-on-change] ws error", e); } catch {} setTimeout(() => {(ws === current) && connect(true)}, 1000)});
            ws.addEventListener('close',(e)=>{setTimeout(() => {(ws === current) && connect(true)}, 1000)});
            ws.addEventListener('message', () => location.reload());
          }
          connect();
        })();`;
      existingBanner["js"] = `${existingJsBanner}${bannerJs}`;

      build.onEnd((result) => {
        if (result.errors.length > 0) {
          return;
        }
        scheduleReload("rebuild");
      });

      // Clean up when build is disposed
      build.onDispose(() => {
        if (watcher) {
          watcher.close();
          watcher = null;
        }
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
