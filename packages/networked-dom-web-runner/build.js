const fs = require("fs");
const path = require("path");

const esbuild = require("esbuild");
const { copy } = require("esbuild-plugin-copy");

const buildMode = "--build";
const watchMode = "--watch";

const helpString = `Mode must be provided as one of ${buildMode} or ${watchMode}`;

const pathToIframeJS = path.resolve(__dirname, "./networked-dom-web-runner-iframe/build/index.js");

const buildOptions = {
  entryPoints: ["src/index.ts"],
  write: true,
  bundle: true,
  format: "cjs",
  outdir: "build",
  platform: "node",
  packages: "external",
  sourcemap: true,
  target: "node14",
  plugins: [
    {
      name: "runner-iframe-js-text-plugin",
      setup({ onResolve, onLoad }) {
        onResolve({ filter: /runner-iframe-js-text/ }, (args) => {
          return { path: pathToIframeJS, namespace: "runner-iframe-js-text-namespace" };
        });
        onLoad({ filter: /.*/, namespace: "runner-iframe-js-text-namespace" }, (args) => {
          return {
            contents: fs.readFileSync(pathToIframeJS, "utf8"),
            loader: "text",
          };
        });
      },
    },
    copy({
      resolveFrom: "cwd",
      assets: {
        from: ["./types-src/**/*"],
        to: ["./build/"],
        keepStructure: true,
      },
    }),
  ],
};

const args = process.argv.splice(2);

if (args.length !== 1) {
  console.error(helpString);
  process.exit(1);
}

const mode = args[0];

switch (mode) {
  case buildMode:
    esbuild.build(buildOptions).catch(() => process.exit(1));
    break;
  case watchMode:
    esbuild
      .context({ ...buildOptions })
      .then((context) => context.watch())
      .catch(() => process.exit(1));
    break;
  default:
    console.error(helpString);
}
