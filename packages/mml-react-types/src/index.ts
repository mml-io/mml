import * as fs from "fs";
import * as path from "path";

import { createSchemaDefinition, schemaJSON } from "@mml-io/mml-schema";

import { createTSDeclarationsFile } from "./createTSDeclarationsFile";

const schemaDefinition = createSchemaDefinition(schemaJSON);

const eventsFile = fs.readFileSync(
  path.join(__dirname, "../../schema/src/schema-src/events.d.ts"),
  "utf-8",
);

const definitionFile = createTSDeclarationsFile(schemaDefinition, eventsFile);
fs.mkdirSync(path.join(__dirname, "../build"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "../build/index.d.ts"), definitionFile);
