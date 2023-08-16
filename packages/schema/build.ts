import * as fs from "fs";
import * as path from "path";

import * as TypeDoc from "typedoc";
import { xml2json } from "xml-js";

const pathToXSD = "./src/schema-src/mml.xsd";
const pathToEventsSchema = "./src/schema-src/events.d.ts";

import { handleLibraryBuild } from "../../utils/build-library";

handleLibraryBuild(
  [
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
    {
      name: "mml-events-schema",
      setup({ onResolve, onLoad }) {
        onResolve({ filter: /mml-events-json/ }, (args) => {
          return { path: pathToEventsSchema, namespace: "events-schema-json-namespace" };
        });
        onLoad({ filter: /.*/, namespace: "events-schema-json-namespace" }, (args) => {
          const app = new TypeDoc.Application();
          app.options.addReader(new TypeDoc.TSConfigReader());

          app.bootstrap({
            tsconfig: path.join(__dirname, "src/schema-src/tsconfig.json"),
            entryPoints: [pathToEventsSchema],
          });

          const project = app.convert()!;
          const eventDefinitions = app.serializer.projectToObject(project, process.cwd());

          return {
            contents: JSON.stringify(eventDefinitions),
            loader: "json",
          };
        });
      },
    },
  ],
  {
    ".xsd": "text",
    ".d.ts": "text",
  },
);
