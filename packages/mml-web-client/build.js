const esbuild = require("esbuild");

const buildMode = "--build";
const serveMode = "--serve";

const helpString = `Mode must be provided as one of ${buildMode} or ${serveMode}`;

const buildOptions = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  write: true,
  format: "cjs",
  sourcemap: true,
  outdir: "build",
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
  case serveMode:
    // eslint-disable-next-line no-case-declarations
    const portArg = process.env.PORT;
    if (!portArg) {
      console.error("PORT environment variable is not set for server");
      process.exit(1);
    }

    esbuild
      .context({ ...buildOptions })
      .then((context) => {
        context.watch();
        context.serve({
          port: parseInt(portArg, 10),
        });
      })
      .catch((e) => {
        console.error(e);
        process.exit(1);
      });
    break;
  default:
    console.error(helpString);
}
