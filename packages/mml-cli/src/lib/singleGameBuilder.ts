import { mmlGameEngineBuildPlugin } from "@mml-io/mml-game-engine-build-plugin";
import { EditableNetworkedDOM, LocalObservableDOMFactory } from "@mml-io/networked-dom-server";
import * as chokidar from "chokidar";
import * as esbuild from "esbuild";
import express, { type Application } from "express";
import enableWs from "express-ws";
import fs from "fs";
import http from "http";
import { createRequire } from "module";
import path from "path";
import * as url from "url";
import { fileURLToPath } from "url";
import type { WebSocket as WsWebSocket } from "ws";

import { pathExists } from "../utils/fs";
import {
  addLogEntry,
  getLogBuffer,
  registerDebugApi,
  registerUser,
  unregisterUser,
} from "./debugApi";
import { registerMcpServer } from "./mcpServer";

export interface SingleGameBuildOptions {
  projectRoot: string;
  srcDir?: string;
  assetsDir?: string;
  outDir?: string;
  watch?: boolean;
}

export interface SingleGameServeOptions extends SingleGameBuildOptions {
  host?: string;
  port?: number;
}

export async function watchSingleGameBuild(
  options: SingleGameBuildOptions,
): Promise<{ stop: () => Promise<void> }> {
  const buildOptions = createBuildOptions({ ...options, watch: true });
  buildOptions.plugins = [...(buildOptions.plugins || []), watchLoggerPlugin({ label: "Rebuild" })];
  const context = await esbuild.context(buildOptions);

  // esbuild >= 0.19: watch() no longer accepts an onRebuild callback.
  // Use an onEnd plugin instead.
  await context.watch();

  console.log("👁️ Watching for changes...");

  return {
    async stop() {
      await context.dispose();
    },
  };
}

function watchLoggerPlugin(options: { label: string }): esbuild.Plugin {
  return {
    name: "watch-logger",
    setup(build) {
      let firstBuild = true;
      build.onEnd(async (result) => {
        if (result.errors.length > 0) {
          const messages = await esbuild.formatMessages(result.errors, {
            kind: "error",
            color: true,
          });
          console.error(messages.join("\n"));
          console.error(`✗ ${options.label} failed`);
          firstBuild = false;
          return;
        }

        if (result.warnings.length > 0) {
          const messages = await esbuild.formatMessages(result.warnings, {
            kind: "warning",
            color: true,
          });
          console.warn(messages.join("\n"));
        }

        console.log(firstBuild ? "✅ Build complete" : "♻️ Rebuilt successfully");
        firstBuild = false;
      });
    },
  };
}

function createBuildOptions(opts: SingleGameBuildOptions): esbuild.BuildOptions {
  const srcDir = opts.srcDir || path.join(opts.projectRoot, "src");
  const entryTs = path.join(srcDir, "main.ts");
  const entryJs = path.join(srcDir, "main.js");
  const entryPoint = fs.existsSync(entryTs) ? entryTs : entryJs;

  if (!fs.existsSync(entryPoint)) {
    throw new Error(`Entry file not found. Expected ${entryTs} (or main.js).`);
  }

  const scriptsConfigPath = path.join(srcDir, "scripts.json");
  const htmlTemplate = path.join(srcDir, "main.mml");

  if (!fs.existsSync(htmlTemplate)) {
    throw new Error(`HTML template not found at ${htmlTemplate}`);
  }

  // const mmlPluginOptions = {
  //   documentPrefix: "ws:///",
  //   assetPrefix: "/assets/",
  //   assetDir: "assets",
  //   stripHtmlExtension: true,
  //   globalNamePrefix: undefined,
  // };

  return {
    entryPoints: [entryPoint],
    entryNames: "[name]",
    assetNames: "[name]",
    bundle: true,
    minify: !opts.watch,
    outdir: opts.outDir || path.join(opts.projectRoot, "build"),
    metafile: true,
    sourcemap: "inline",
    publicPath: "/",
    platform: "browser",
    target: "es2020",
    loader: {
      ".png": "file",
      ".jpg": "file",
      ".jpeg": "file",
      ".gif": "file",
      ".svg": "file",
      ".glb": "file",
      ".hdr": "file",
      ".mml": "text",
      ".html": "text",
    },
    plugins: [
      mmlGameEngineBuildPlugin({
        configPath: scriptsConfigPath,
        htmlTemplate,
        filename: "index.html",
        assetsDir: opts.assetsDir || path.join(opts.projectRoot, "assets"),
      }),
    ],
  };
}

export async function buildSingleGame(options: SingleGameBuildOptions): Promise<void> {
  const buildOptions = createBuildOptions(options);
  await esbuild.build(buildOptions);
  console.log("✅ Build complete");
}

export async function watchSingleGame(
  options: SingleGameServeOptions,
): Promise<{ stop: () => Promise<void> }> {
  const srcDir = options.srcDir || path.join(options.projectRoot, "src");
  const assetsSourceDir = options.assetsDir || path.join(options.projectRoot, "assets");

  const buildOptions = createBuildOptions(options);
  const outDir = buildOptions.outdir || path.join(options.projectRoot, "build");

  // Node-side persistent document that clients connect to via websocket.
  // This ensures page refreshes reconnect cleanly (no duplicated node IDs) and rebuilds only reload the game content.
  const port = options.port ?? 3000;
  const host = options.host ?? "0.0.0.0";
  const browseHost = host === "0.0.0.0" ? "localhost" : host;
  // Mirror `multi-game-builder` behavior: use a stable file:// URL as the JSDOM "document URL".
  // This avoids server-side execution depending on an http origin and reduces resource-loading edge cases.
  const documentKey = path.basename(options.projectRoot);
  const documentBaseUrl = url.pathToFileURL(documentKey).toString();
  const gameDocument = new EditableNetworkedDOM(documentBaseUrl, LocalObservableDOMFactory, false);

  function resolveDevRunnerDir(): string {
    // The CLI is bundled to `packages/mml-cli/build/index.js`.
    // Use import.meta.url to locate `packages/mml-cli/templates/dev-runner`.
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      // Normal (bundled) location: build/ -> templates/
      path.resolve(here, "../templates/dev-runner"),
      // Fallbacks (in case bundling/layout changes)
      path.resolve(here, "../../templates/dev-runner"),
    ];
    for (const dir of candidates) {
      const indexPath = path.join(dir, "index.html");
      const runnerPath = path.join(dir, "runner.ts");
      if (fs.existsSync(indexPath) && fs.existsSync(runnerPath)) {
        return dir;
      }
    }
    throw new Error(`Dev runner template not found. Looked in: ${candidates.join(", ")}`);
  }

  async function buildRunnerClientScript(devRunnerDir: string): Promise<string> {
    // Bundle the runner client script from a real file (templates/dev-runner/runner.ts).
    const runnerEntryPath = path.join(devRunnerDir, "runner.ts");

    const require = createRequire(import.meta.url);
    const mmlClientPkgJsonPath = require.resolve("mml-game-engine-client/package.json");
    // Resolve from the folder containing `node_modules/` (works both in monorepo and when installed).
    const nodeModulesDir = path.dirname(path.dirname(mmlClientPkgJsonPath));
    const moduleResolveDir = path.dirname(nodeModulesDir);

    const buildResult = await esbuild.build({
      absWorkingDir: moduleResolveDir,
      entryPoints: [runnerEntryPath],
      write: false,
      bundle: true,
      minify: false,
      sourcemap: "inline",
      platform: "browser",
      target: "es2020",
      format: "iife",
      define: {
        "process.env.NODE_ENV": JSON.stringify("development"),
      },
    });

    const outFile = buildResult.outputFiles?.[0];
    if (!outFile) {
      throw new Error("Failed to build dev runner client script (no output)");
    }
    return outFile.text;
  }

  // Asset server URL for server-side systems (physics, navigation) to resolve relative paths
  const assetServerUrl = `http://${browseHost}:${port}`;

  let pendingDocumentReloadReason: string | null = null;
  let documentReloadTimer: NodeJS.Timeout | null = null;
  let loaded = false;
  const scheduleDocumentReload = (reason: string) => {
    pendingDocumentReloadReason = reason;
    if (documentReloadTimer) {
      return;
    }
    documentReloadTimer = setTimeout(async () => {
      documentReloadTimer = null;
      const r = pendingDocumentReloadReason ?? "change";
      pendingDocumentReloadReason = null;
      try {
        const html = await loadGameIndexHtml();
        if (!html) {
          // Build may not have produced an index yet; keep current content.
          return;
        }
        console.log(`♻️  [dev-hot] reloading game document (${r})`);
        // Pass asset server URL so server-side systems can resolve relative asset URLs
        gameDocument.load(html, { __ASSET_SERVER_URL__: assetServerUrl });
        if (loaded) {
          console.log("already loaded");
          return;
        }
        loaded = true;
      } catch (e) {
        console.error("Failed to reload game document:", e);
      }
    }, 50);
  };

  buildOptions.plugins = [
    ...(buildOptions.plugins || []),
    watchLoggerPlugin({ label: "Rebuild" }),
    {
      name: "networked-dom-server-reload",
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length > 0) {
            return;
          }
          scheduleDocumentReload("rebuild");
        });
      },
    },
  ];
  const context = await esbuild.context(buildOptions);

  // esbuild >= 0.19: watch() no longer accepts an onRebuild callback.
  // Use an onEnd plugin instead.
  await context.watch();

  // Watch additional inputs that esbuild might not track (assets + templates/config) and force a rebuild.
  // This ensures changes in assets/ and main.mml/scripts.json always rebuild + reload.
  let rebuildInFlight: Promise<unknown> | null = null;
  let rebuildQueued = false;
  const triggerRebuild = (reason: string) => {
    if (rebuildInFlight) {
      rebuildQueued = true;
      return;
    }
    console.log(`♻️  [dev-watch] rebuild requested (${reason})`);
    rebuildInFlight = context
      .rebuild()
      .then(() => undefined)
      .finally(() => {
        rebuildInFlight = null;
        if (rebuildQueued) {
          rebuildQueued = false;
          triggerRebuild("queued");
        }
      });
  };

  const devWatcher = chokidar.watch([srcDir, assetsSourceDir], {
    ignored: /(^|[/\\])\../, // Ignore dotfiles
    persistent: true,
    ignoreInitial: true,
  });

  devWatcher.on("all", (event, changedPath) => {
    console.log(`👁️  [dev-watch] ${event}: ${changedPath}`);
    const lower = changedPath.toLowerCase();
    const ext = path.extname(lower);

    // Rebuild for inputs that are likely not in esbuild's dependency graph, or need asset copying.
    const shouldRebuild =
      lower.startsWith(assetsSourceDir.toLowerCase()) ||
      ext === ".mml" ||
      ext === ".html" ||
      ext === ".css" ||
      lower.endsWith(`${path.sep}scripts.json`) ||
      // Many projects keep non-imported configs/data in src; rebuild to be safe.
      ext === ".json";

    if (shouldRebuild) {
      triggerRebuild(`${event}: ${changedPath}`);
    }
  });

  const assetsDir = options.assetsDir || path.join(outDir, "assets");
  // express-ws types are incompatible with Express 5 types, use any to bypass

  const wsInstance = enableWs(express() as any);
  const app = wsInstance.app as unknown as Application & { ws: typeof wsInstance.app.ws };
  app.enable("trust proxy");

  // Parse JSON bodies
  app.use(express.json());

  // Parse URL-encoded bodies
  app.use(express.urlencoded({ extended: true }));

  // Disable client caching for all responses
  app.use((req, res, next) => {
    res.header("Cache-Control", "no-cache, no-store, must-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", "0");
    next();
  });

  // Minimal runner (game client UI) is hosted at the root (/)
  const devRunnerDir = resolveDevRunnerDir();
  const runnerClientScript = await buildRunnerClientScript(devRunnerDir);

  app.get("/runner.js", (_req, res) => {
    res.type("application/javascript").send(runnerClientScript);
  });

  const runnerIndexPath = path.join(devRunnerDir, "index.html");
  app.get(["/", "/index.html"], (_req, res) => {
    res.sendFile(runnerIndexPath);
  });

  async function loadGameIndexHtml(): Promise<string | null> {
    const indexPath = path.join(outDir, "index.html");
    if (!(await pathExists(indexPath))) {
      return null;
    }
    return await fs.promises.readFile(indexPath, "utf-8");
  }

  async function loadGameManifestJson(): Promise<string | null> {
    const manifestPath = path.join(outDir, "manifest.json");
    if (!(await pathExists(manifestPath))) {
      return null;
    }
    return await fs.promises.readFile(manifestPath, "utf-8");
  }

  // Game server is hosted under /server/*
  app.get(/^\/server$/, (_req, res) => res.redirect(302, "/server/"));
  app.get(["/server/", "/server/index.html"], async (_req, res) => {
    const html = await loadGameIndexHtml();
    if (!html) {
      return res.status(503).send("Game is still building. Please refresh in a moment.");
    }
    res.type("html").send(html);
  });

  app.get("/server/manifest.json", async (_req, res) => {
    const manifest = await loadGameManifestJson();
    if (!manifest) {
      return res.status(404).send("manifest.json not found");
    }
    res.type("json").send(manifest);
  });

  // Serve game build output under /server/* (but don't let express.static serve index.html; we handle it above).
  app.use(
    "/server",
    express.static(outDir, {
      index: false,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      },
    }),
  );

  // Optional compatibility: also expose assets at /assets/* (root) since many templates reference /assets/.
  // This keeps existing games working even if they hardcode /assets paths.
  if (await pathExists(assetsDir)) {
    app.use(
      "/assets",
      express.static(assetsDir, {
        setHeaders: (res) => {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        },
      }),
    );
  }

  // Websocket endpoint that serves the persistent NetworkedDOM document.
  // This is what the game client should connect to (ws://.../mml).
  // const server = http.createServer(app);
  // const wss = new WebSocketServer({
  //   noServer: true,
  //   handleProtocols: (protocols) => NetworkedDOM.handleWebsocketSubprotocol(protocols),
  // });

  // Register debug API endpoints
  registerDebugApi({
    app,
    gameDocument,
    getConnectedClients: () => connectedClients,
    host: browseHost,
    port,
  });

  // Register MCP server at /mcp
  registerMcpServer({
    app,
    getConnectedClients: () => connectedClients,
    host: browseHost,
    port,
    assetsDir: assetsSourceDir,
    getLogBuffer,
    pushLogEntry: addLogEntry,
  });

  // Track connected clients
  const connectedClients = new Map<string, { id: string; connectedAt: number }>();
  let clientIdCounter = 0;

  app.ws("/mml", (ws: WsWebSocket) => {
    const clientId = `client-${++clientIdCounter}`;
    connectedClients.set(clientId, { id: clientId, connectedAt: Date.now() });
    registerUser(clientId);

    gameDocument.addWebSocket(ws as unknown as WebSocket);
    console.log(`WebSocket connection established: ${clientId}`);

    ws.on("close", () => {
      connectedClients.delete(clientId);
      unregisterUser(clientId);
      try {
        if (gameDocument.hasWebSocket(ws as unknown as WebSocket)) {
          gameDocument.removeWebSocket(ws as unknown as WebSocket);
        }
      } catch (_e) {
        // Ignore if already removed/disposed
      }
    });
  });

  let server: http.Server | null = null;

  await new Promise<void>((resolve, reject) => {
    server = app.listen(port, host, () => {
      console.log(`🎮 Runner UI (game client) at http://${browseHost}:${port}/`);
      console.log(`📡 Game files (static) at http://${browseHost}:${port}/server/`);
      console.log(`🔌 Game document websocket at ws://${browseHost}:${port}/mml`);
      console.log(`🔧 Debug API at http://${browseHost}:${port}/debug/status`);
      console.log(`🤖 MCP server at http://${browseHost}:${port}/mcp/sse`);
      console.log(`Dev server started on port ${port}`);
      resolve();
    });
    server.on("error", (err) => reject(err));
  });

  // Initial load into the persistent document (once build output exists).
  scheduleDocumentReload("initial");

  return {
    async stop() {
      await devWatcher.close();
      await context.dispose();
      try {
        server?.close();
      } catch (_e) {
        // ignore
      }
      try {
        gameDocument.dispose();
      } catch (_e) {
        // ignore
      }
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    },
  };
}
