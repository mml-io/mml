import { htmlPlugin } from "@craftamap/esbuild-plugin-html"
import * as esbuild from "esbuild"
import { copy } from "esbuild-plugin-copy"
import postCssPlugin from "esbuild-style-plugin"
import { rebuildOnDependencyChangesPlugin } from "../../utils/rebuildOnDependencyChangesPlugin";
import express from "express"
import fs from "fs"
import path from "path"

import { reloadOnChangePlugin } from "../../utils/reloadOnChangePlugin"

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
    ...(mode === watchMode ? [
      rebuildOnDependencyChangesPlugin(),
    ] : []),
    copy({
      resolveFrom: "cwd",
      assets: {
        from: ["./public/**/*"],
        to: ["./build/"],
      },
    }),
    postCssPlugin({
      postcss: {
        plugins: [],
      },
    }),
    htmlPlugin({
      files: [
        {
          entryPoints: ["src/index.ts"],
          filename: "index.html",
          htmlTemplate: "./public/index.html",
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
        plugins: [
          ...buildOptions.plugins!,
          reloadOnChangePlugin({
            enabled: true,
            /*
             Watch for changes to trigger reload
            */
            watchDir: "./build/index.html",
          }),
        ],
      })
      .then((context) => {
        context.watch()
        
        // Start Express server
        const app = express()
        const port = 3030
        const host = "localhost"
        
        // Serve static files from build directory
        app.use(express.static(path.resolve("./build")))
        
        // Serve index.html at root with retry logic
        app.get("/", async (req, res) => {
          const maxRetries = 3
          let attempt = 0
          const indexPath = path.resolve("./build/index.html")
          
          const tryServeFile = (): Promise<boolean> => {
            return new Promise((resolve) => {
              // Check if file exists and has content before attempting to serve
              fs.stat(indexPath, (err, stats) => {
                if (err || !stats.isFile() || stats.size === 0) {
                  resolve(false)
                  return
                }
                
                // File looks good, try to serve it
                res.sendFile(indexPath, (sendErr) => {
                  if (sendErr) {
                    // sendFile failed (file might have been deleted/truncated between stat and sendFile)
                    resolve(false)
                  } else {
                    // Successfully sent
                    resolve(true)
                  }
                })
              })
            })
          }
          
          while (attempt < maxRetries) {
            const success = await tryServeFile()
            if (success) {
              return // File served successfully
            }
            
            attempt++
            console.log(`⏳ index.html missing or empty, retry ${attempt}/${maxRetries}...`)
            
            if (attempt < maxRetries) {
              // Wait 1 second before retrying
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          }
          
          // If all retries failed, send an error response
          res.status(503).send(`
            <!DOCTYPE html>
            <html>
              <head><title>Service Unavailable</title></head>
              <body>
                <h1>Service Unavailable</h1>
                <p>The application is still building. Please refresh the page in a moment.</p>
                <script>
                  // Auto-refresh every 2 seconds
                  setTimeout(() => window.location.reload(), 2000);
                </script>
              </body>
            </html>
          `)
        })
        
        app.listen(port, host, () => {
          console.log(
            `🚀 MML Game Engine Example running at http://${host}:${port}`,
          )
          console.log(
            "🔄 Auto-refresh enabled via WebSocket - page will reload when files change",
          )
        })
      })
      .catch(() => process.exit(1))
    break
  default:
    console.error(helpString)
}
