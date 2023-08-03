import { createTSDefinitionFile, JSONSchema } from "./buildDeclarationFile";
import { createSchemaDefinition, schemaJSON } from "../build/index";

test("JSON schema created cubes", () => {
  const schemaDefinition = createSchemaDefinition(schemaJSON);

  createTSDefinitionFile(schemaDefinition as JSONSchema);

  expect(schemaDefinition.elements["m-cube"].name).toEqual("m-cube");
});
