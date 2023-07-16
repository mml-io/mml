const esbuild = require("esbuild");
const { dtsPlugin } = require("esbuild-plugin-d.ts");

const buildMode = "--build";
const watchMode = "--watch";

const helpString = `Mode must be provided as one of ${buildMode} or ${watchMode}`;

function handleLibraryBuild(plugins = [], loader = {}) {
  const args = process.argv.splice(2);

  if (args.length !== 1) {
    console.error(helpString);
    process.exit(1);
  }

  const mode = args[0];

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
      ...loader,
    },
    plugins: [...plugins, dtsPlugin()],
  };

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
}

module.exports = {
  handleLibraryBuild,
};
