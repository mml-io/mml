import fs from "fs";
import path from "path";
import * as url from "url";

import { createSchemaDefinition, schemaJSON } from "@mml-io/mml-schema";

import { JSONSchema } from "./buildDeclarationFile.ts";
import { createTSDefinitionFile } from "./createTSDefinitionFile.ts";

const schemaDefinition = createSchemaDefinition(schemaJSON);

const dirname = url.fileURLToPath(new URL(".", import.meta.url));

const eventsFile = fs.readFileSync(
  path.join(dirname, "../../schema/src/schema-src/events.d.ts"),
  "utf-8",
);

const definitionFile = createTSDefinitionFile(schemaDefinition as JSONSchema, eventsFile);
fs.mkdirSync(path.join(dirname, "../build"), { recursive: true });
fs.writeFileSync(path.join(dirname, "../build/index.d.ts"), definitionFile);
