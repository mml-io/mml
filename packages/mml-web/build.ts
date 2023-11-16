import fs from "fs";

import { handleLibraryBuild } from "../../utils/build-library";

const dracoDecoderWasm = fs.readFileSync(
  "../../node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm",
);
if (!dracoDecoderWasm) {
  throw new Error("Failed to read draco_decoder.wasm");
}
const dracoWasmWrapperJs = fs.readFileSync(
  "../../node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js",
);
if (!dracoWasmWrapperJs) {
  throw new Error("Failed to read draco_wasm_wrapper.js");
}

handleLibraryBuild([
  {
    name: "embed-draco-decoder",
    setup({ onResolve, onLoad }) {
      onResolve(
        { filter: /(esbuild-embed-draco-decoder-wasm|esbuild-embed-draco-wasm-wrapper-js)/ },
        (args) => {
          return { path: args.path, namespace: "embed-draco-decoder" };
        },
      );
      onLoad({ filter: /.*/, namespace: "embed-draco-decoder" }, (args) => {
        if (args.path === "esbuild-embed-draco-decoder-wasm") {
          return {
            contents: dracoDecoderWasm,
            loader: "base64",
          };
        } else if (args.path === "esbuild-embed-draco-wasm-wrapper-js") {
          return {
            contents: dracoWasmWrapperJs,
            loader: "text",
          };
        }
        throw new Error("Unknown path for embed-draco-decoder plugin: " + args.path);
      });
    },
  },
]);
