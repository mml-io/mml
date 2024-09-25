import fs from "fs";

import { base64Plugin } from "../../utils/base64plugin";
import { handleLibraryBuild } from "../../utils/build-library";

const glslangWasmContents = fs.readFileSync("./src/wasm/glslang.wasm");
const glslangWasmContentsBase64 = glslangWasmContents.toString("base64");

const twgslWasmContents = fs.readFileSync("./src/wasm/twgsl.wasm");
const twgslWasmContentsBase64 = twgslWasmContents.toString("base64");

handleLibraryBuild([
  base64Plugin({
    replacements: {
      '= "glslang.wasm";': `= "data:application/octet-stream;base64,${glslangWasmContentsBase64}";`,
      '= "twgsl.wasm";': `= "data:application/octet-stream;base64,${twgslWasmContentsBase64}";`,
    },
  }),
]);
