import { htmlPlugin } from "@craftamap/esbuild-plugin-html";
import * as esbuild from "esbuild";
import express from "express";
import fs from "fs";
import path from "path";
import { textPlugin } from "../../utils/textPlugin";
import { rebuildOnDependencyChangesPlugin } from "../../utils/rebuildOnDependencyChangesPlugin";
import { reloadOnChangePlugin } from "../../utils/reloadOnChangePlugin";
import tailwindcss from "@tailwindcss/postcss"
import postCssPlugin from "esbuild-style-plugin"

const buildMode = "--build";
const watchMode = "--watch";

const helpString = `Mode must be provided as one of ${buildMode} or ${watchMode}`;

const args = process.argv.splice(2);

if (args.length !== 1) {
  console.error(helpString);
  process.exit(1);
}

const mode = args[0];

const buildOptions: esbuild.BuildOptions = {
  entryPoints: ["src/main.tsx"],
  entryNames: "[dir]/[name]-[hash]",
  assetNames: "[dir]/[name]-[hash]",
  bundle: true,
  minify: mode === buildMode,
  outdir: "./build",
  metafile: true,
  sourcemap: "inline",
  publicPath: "/",
  platform: "browser",
  target: "es2020",
  loader: {
    ".png": "file",
    ".jpg": "file",
    ".svg": "file",
    ".woff": "file",
    ".woff2": "file",
  },
  plugins: [
    ...(mode === watchMode
      ? [
          rebuildOnDependencyChangesPlugin(),
          reloadOnChangePlugin({
            enabled: true,
            watchDir: "./build/index.html",
          }),
        ]
      : []),
    textPlugin(),
    htmlPlugin({
      files: [
        {
          entryPoints: ["src/main.tsx"],
          filename: "index.html",
          htmlTemplate: "./src/index.html",
        },
      ],
    }),
    postCssPlugin({
      postcss: {
        plugins: [tailwindcss],
      },
      cssModulesOptions: {
        localsConvention: "camelCaseOnly",
        scopeBehaviour: "local",
        generateScopedName: "[name]__[local]___[hash:base64:5]",
      },
    }),
  ],
};

switch (mode) {
  case buildMode:
    esbuild.build(buildOptions).catch(() => process.exit(1));
    break;
  case watchMode:
    esbuild
      .context({
        ...buildOptions,
      })
      .then((context) => {
        context.watch();

        // Start Express server
        const app = express();
        const port = 3032;
        const host = "0.0.0.0";

        // Serve static files from build directory
        app.use(express.static(path.resolve("./build")));

        // Serve index.html at root
        app.get("/", async (req, res) => {
          const indexPath = path.resolve("./build/index.html");

          if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
          } else {
            res.status(503).send(`
              <!DOCTYPE html>
              <html>
                <head><title>Service Unavailable</title></head>
                <body>
                  <h1>Service Unavailable</h1>
                  <p>The application is still building. Please refresh the page in a moment.</p>
                  <script>
                    setTimeout(() => window.location.reload(), 2000);
                  </script>
                </body>
              </html>
            `);
          }
        });

        app.listen(port, host, () => {
          console.log(
            `🚀 MML Editor at http://${host}:${port}`
          );
        });
      })
      .catch(() => process.exit(1));
    break;
  default:
    console.error(helpString);
}
