import { htmlPlugin } from "@craftamap/esbuild-plugin-html"
import * as esbuild from "esbuild"
import postCssPlugin from "esbuild-style-plugin"
import express from "express"
import fs from "fs"
import path from "path"
import { textPlugin } from "../../../utils/textPlugin"
import { rebuildOnDependencyChangesPlugin } from "../../../utils/rebuildOnDependencyChangesPlugin";
import { reloadOnChangePlugin } from "../../../utils/reloadOnChangePlugin";

const buildMode = "--build"
const watchMode = "--watch"

const helpString = `Mode must be provided as one of ${buildMode} or ${watchMode}`

const args = process.argv.splice(2)

if (args.length !== 1) {
  console.error(helpString)
  process.exit(1)
}

const mode = args[0]

const buildOptions: esbuild.BuildOptions = {
  entryPoints: ["src/index.ts"],
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
  plugins: [
    ...(mode === watchMode ? [
      rebuildOnDependencyChangesPlugin(),
      reloadOnChangePlugin({
        enabled: true,
        watchDir: "./build/index.html",
      }),
    ] : []),
    postCssPlugin({
      postcss: {
        plugins: [],
      },
    }),
    textPlugin(),
    htmlPlugin({
      files: [
        {
          entryPoints: ["src/index.ts"],
          filename: "index.html",
          htmlTemplate: "./src/index.html",
        },
      ],
    }),
  ],
}

switch (mode) {
  case buildMode:
    esbuild.build(buildOptions).catch(() => process.exit(1))
    break
  case watchMode:
    esbuild
      .context({
        ...buildOptions,
      })
      .then((context) => {
        context.watch()
        
        // Start Express server
        const app = express()
        const port = 3031
        const host = "0.0.0.0"
        
        // Serve static files from build directory
        app.use(express.static(path.resolve("./build")))
        
        // Serve index.html at root
        app.get("/", async (req, res) => {
          const indexPath = path.resolve("./build/index.html")
          
          if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath)
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
            `)
          }
        })
        
        app.listen(port, host, () => {
          console.log(
            `🚀 Standalone Game Example Runner at http://${host}:${port}`,
          )
          console.log(
            `🎮 Game content available at http://${host}:${port}/game`,
          )
        })
      })
      .catch(() => process.exit(1))
    break
  default:
    console.error(helpString)
}
