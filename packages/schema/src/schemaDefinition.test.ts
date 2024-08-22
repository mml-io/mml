// eslint-disable-next-line  @typescript-eslint/ban-ts-comment
// @ts-ignore - this index is missing until the build completes, but the type check of this file will cause the build to fail unless this import is ignored
import { createSchemaDefinition, schemaJSON } from "../build/index";

test("JSON schema created cubes", () => {
  const schemaDefinition = createSchemaDefinition(schemaJSON);

  expect(schemaDefinition.elements["m-cube"].name).toEqual("m-cube");
});
