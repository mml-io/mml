import { createSchemaDefinition, schemaJSON } from "../build/index";

test("JSON schema created cubes", () => {
  const schemaDefinition = createSchemaDefinition(schemaJSON);

  expect(schemaDefinition.elements["m-cube"].name).toEqual("m-cube");
});
