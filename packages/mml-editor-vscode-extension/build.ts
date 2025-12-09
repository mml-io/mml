import { build, context } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes("--watch");

const distDir = join(__dirname, "dist");

const shared = {
  bundle: true,
  sourcemap: true,
  logLevel: "info" as const,
};

async function runBuild() {
  const extensionConfig = {
    ...shared,
    entryPoints: [join(__dirname, "src", "extension.ts")],
    outfile: join(distDir, "extension.js"),
    platform: "node" as const,
    format: "cjs" as const,
    target: ["node18"],
    external: ["vscode"],
  };

  const webviewConfig = {
    ...shared,
    entryPoints: [join(__dirname, "src", "webview", "main.ts")],
    outfile: join(distDir, "webview.js"),
    platform: "browser" as const,
    format: "iife" as const,
    target: ["es2022"],
    define: {
      "process.env.NODE_ENV": JSON.stringify(isWatch ? "development" : "production"),
    },
  };

  if (isWatch) {
    const extensionCtx = await context(extensionConfig);
    const webviewCtx = await context(webviewConfig);
    await extensionCtx.watch();
    await webviewCtx.watch();
    console.log("Watching for changes...");
    return;
  }

  await build(extensionConfig);
  await build(webviewConfig);
}

runBuild().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

