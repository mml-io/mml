import * as fs from "fs";
import * as path from "path";
import url from "url";

import { handleLibraryBuild } from "../../utils/build-library";

const dirname = url.fileURLToPath(new URL(".", import.meta.url));
const pathToIframeJS = path.resolve(dirname, "./networked-dom-web-runner-iframe/build/index.js");

handleLibraryBuild([
  {
    name: "runner-iframe-js-text-plugin",
    setup({ onResolve, onLoad }) {
      onResolve({ filter: /runner-iframe-js-text/ }, () => {
        return { path: pathToIframeJS, namespace: "runner-iframe-js-text-namespace" };
      });
      onLoad({ filter: /.*/, namespace: "runner-iframe-js-text-namespace" }, () => {
        return {
          contents: fs.readFileSync(pathToIframeJS, "utf8"),
          loader: "text",
        };
      });
    },
  },
]);
