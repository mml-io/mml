import * as esbuild from "esbuild";
import { copy } from "esbuild-plugin-copy";
import { dtsPlugin } from "../../../utils/dtsPlugin";
import { rebuildOnDependencyChangesPlugin } from '../../../utils/rebuildOnDependencyChangesPlugin';

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
    entryPoints: ["src/index.ts"],
    write: true,
    bundle: true,
    format: "iife",
    outdir: "build",
    outbase: "./src",
    platform: "browser",
    // Remove packages: "external" to bundle everything
    sourcemap: true,
    target: "es2020",
    mainFields: ["module", "main"],
    conditions: ["import", "module", "default"],
    banner: {
        js: `// Polyfill for TextEncoder/TextDecoder (needed by Rapier WASM)
if (typeof TextEncoder === "undefined") {
  globalThis.TextEncoder = class TextEncoder {
    encode(str) {
      const buf = new ArrayBuffer(str.length);
      const bufView = new Uint8Array(buf);
      for (let i = 0; i < str.length; i++) {
        bufView[i] = str.charCodeAt(i);
      }
      return bufView;
    }
  };
}
if (typeof TextDecoder === "undefined") {
  globalThis.TextDecoder = class TextDecoder {
    decode(arr) {
      return String.fromCharCode(...arr);
    }
  };
}`,
    },
    plugins: [
        ...(mode === watchMode ? [
            rebuildOnDependencyChangesPlugin()
        ] : []),
        copy({
            resolveFrom: 'cwd',
            assets: [
                {
                    from: ['./src/mml.schema.json'],
                    to: ['./build/mml.schema.json'],
                }
            ]
        }),
        dtsPlugin(),
    ],
    // Handle WASM files for Rapier
    loader: {
        '.wasm': 'file',
    },
    // Resolve node modules
    external: [], // Don't externalize anything
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