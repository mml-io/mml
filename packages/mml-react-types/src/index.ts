import * as fs from "fs";
import * as path from "path";
import url from "url";

import { createSchemaDefinition, schemaJSON } from "@mml-io/mml-schema";

import { createTSDeclarationsFile } from "./createTSDeclarationsFile";

const dirname = url.fileURLToPath(new URL(".", import.meta.url));

(async () => {
  const schemaDefinition = createSchemaDefinition(schemaJSON);

  const eventsFile = fs.readFileSync(
    path.join(dirname, "../../schema/src/schema-src/events.d.ts"),
    "utf-8",
  );

  const definitionFile = await createTSDeclarationsFile(schemaDefinition, eventsFile);
  fs.mkdirSync(path.join(dirname, "../build"), { recursive: true });
  fs.writeFileSync(path.join(dirname, "../build/index.d.ts"), definitionFile);
})();
