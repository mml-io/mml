import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { Material } from "../src/elements/Material";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-material", () => {
  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-material", Material);
    expect(schema.name).toEqual(Material.tagName);
  });
});
