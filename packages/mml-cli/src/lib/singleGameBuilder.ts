import express from "express";
import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";

import { mmlGameEngineBuildPlugin } from "@mml-io/mml-game-engine-build-plugin";

import { pathExists } from "../utils/fs";
// import { mml } from "@mml-io/esbuild-plugin-mml";

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
  const context = await esbuild.context(buildOptions);

  await context.watch({
    onRebuild(error, result) {
      if (error) {
        console.error("✗ Rebuild failed:", error);
      } else if (result) {
        console.log("♻️ Rebuilt successfully");
      }
    },
  });

  console.log("👁️ Watching for changes...");

  return {
    async stop() {
      await context.dispose();
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

  const mmlPluginOptions = {
    documentPrefix: "ws:///",
    assetPrefix: "/assets/",
    assetDir: "assets",
    stripHtmlExtension: true,
    globalNamePrefix: undefined,
  };

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
      mml({
        verbose: true,
        ...mmlPluginOptions,
      }),
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
  const buildOptions = await createBuildOptions(options);
  await esbuild.build(buildOptions);
  console.log("✅ Build complete");
}

export async function watchSingleGame(
  options: SingleGameServeOptions,
): Promise<{ stop: () => Promise<void> }> {
  const buildOptions = await createBuildOptions(options);
  const context = await esbuild.context(buildOptions);

  await context.watch({
    onRebuild(error, result) {
      if (error) {
        console.error("✗ Rebuild failed:", error);
      } else if (result) {
        console.log("♻️ Rebuilt successfully");
      }
    },
  });

  const outDir = buildOptions.outdir || path.join(options.projectRoot, "build");
  const assetsDir = options.assetsDir || path.join(outDir, "assets");
  const app = express();

  // Disable caching
  app.use((req, res, next) => {
    res.header("Cache-Control", "no-cache, no-store, must-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", "0");
    next();
  });

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

  app.use(
    express.static(outDir, {
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      },
    }),
  );

  app.get("/", (_req, res) => {
    const indexPath = path.join(outDir, "index.html");
    res.sendFile(indexPath);
  });

  const port = options.port ?? 3000;
  const host = options.host ?? "0.0.0.0";

  const server = await new Promise<import("http").Server>((resolve) => {
    const srv = app.listen(port, host, () => {
      console.log(`📡 Serving game at http://${host}:${port}`);
      resolve(srv);
    });
  });

  return {
    async stop() {
      await context.dispose();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
