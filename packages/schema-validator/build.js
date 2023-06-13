const fs = require("fs");

const esbuild = require("esbuild");
const { copy } = require("esbuild-plugin-copy");
const { xml2json } = require("xml-js");

const buildMode = "--build";

const watchMode = "--watch";

const helpString = `Mode must be provided as one of ${buildMode} or ${watchMode}`;

const pathToXSD = "./src/mml.xsd";

// build index
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
  loader: {
    ".xsd": "text",
  },
  plugins: [
    {
      name: "mml-xsd",
      setup({ onResolve, onLoad }) {
        onResolve({ filter: /mml-xsd-json/ }, (args) => {
          return { path: pathToXSD, namespace: "xsd-json-namespace" };
        });
        onLoad({ filter: /.*/, namespace: "xsd-json-namespace" }, (args) => {
          return {
            contents: xml2json(fs.readFileSync(pathToXSD, "utf8"), {
              compact: true,
              alwaysArray: true,
            }),
            loader: "json",
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
