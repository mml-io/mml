import { createSchemaDefinition, schemaJSON } from "@mml-io/mml-schema";

import { MElement } from "../build/index";
import { GraphicsAdapter } from "../build/index";

type MElementClass = {
  new (): MElement<GraphicsAdapter>;
  tagName: string;
  observedAttributes: string[];
} & typeof HTMLElement;

export function testElementSchemaMatchesObservedAttributes(
  elementTag: string,
  elementClass: MElementClass,
) {
  const schemaDefinition = createSchemaDefinition(schemaJSON);
  const elementSchema = schemaDefinition.elements[elementTag];
  expect(elementSchema).toBeTruthy();
  expect(elementSchema.name).toEqual(elementClass.tagName);

  const webClientAttributes = new Set(elementClass.observedAttributes);
  const schemaAttributes = new Set<string>();

  for (const attr of elementSchema.attributes) {
    if (attr.type !== "Script") {
      schemaAttributes.add(attr.name);
    }
  }

  for (const attrGroupName of elementSchema.attributeGroups) {
    const attrGroup = schemaDefinition.attributeGroups[attrGroupName];
    for (const attr of attrGroup.attributes) {
      if (attr.type !== "Script") {
        schemaAttributes.add(attr.name);
      }
    }
  }

  // Attributes that client-side custom elements do not need to implement
  const exceptionAttributes = new Set(["id", "class", "onclick"]);

  const unobservedSchemaAttributes: string[] = [];
  schemaAttributes.forEach((attr: string) => {
    if (!webClientAttributes.has(attr) && !exceptionAttributes.has(attr)) {
      unobservedSchemaAttributes.push(attr);
    }
  });

  expect(unobservedSchemaAttributes).toHaveLength(0);

  const webAttributesNotInSchema: string[] = [];
  webClientAttributes.forEach((attr: string) => {
    if (!schemaAttributes.has(attr)) {
      webAttributesNotInSchema.push(attr);
    }
  });

  expect(
    webAttributesNotInSchema,
    `The following attributes are observed by the three ${elementTag} implementation, but are not in the schema: ${webAttributesNotInSchema}`,
  ).toHaveLength(0);

  return elementSchema;
}
