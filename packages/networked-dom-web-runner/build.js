const fs = require("fs");
const path = require("path");

const { handleLibraryBuild } = require("../../utils/build-library");

const pathToIframeJS = path.resolve(__dirname, "./networked-dom-web-runner-iframe/build/index.js");

handleLibraryBuild([
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
]);
