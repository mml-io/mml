import * as fs from "fs";
import * as path from "path";
import * as TypeDoc from "typedoc";
import url from "url";
import { xml2json } from "xml-js";

import { handleLibraryBuild } from "../../utils/build-library";

const pathToXSD = "./src/schema-src/mml.xsd";
const pathToEventsSchema = "./src/schema-src/events.d.ts";
const dirname = url.fileURLToPath(new URL(".", import.meta.url));

handleLibraryBuild(
  [
    {
      name: "mml-xsd",
      setup({ onResolve, onLoad }) {
        onResolve({ filter: /mml-xsd-json/ }, () => {
          return { path: pathToXSD, namespace: "xsd-json-namespace" };
        });
        onLoad({ filter: /.*/, namespace: "xsd-json-namespace" }, () => {
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
        onResolve({ filter: /mml-events-json/ }, () => {
          return { path: pathToEventsSchema, namespace: "events-schema-json-namespace" };
        });
        onLoad({ filter: /.*/, namespace: "events-schema-json-namespace" }, async () => {
          const app = await TypeDoc.Application.bootstrapWithPlugins(
            {
              entryPoints: [pathToEventsSchema],
              entryPointStrategy: TypeDoc.EntryPointStrategy.Resolve,
              tsconfig: path.join(dirname, "events-tsconfig.json"),
            },
            [new TypeDoc.TSConfigReader()],
          );

          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const project = (await app.convert())!;
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
