import { createSchemaDefinition, schemaJSON } from "@mml-io/mml-schema";



type MElementClass = {
  new (): MElement;
  tagName: string;
  observedAttributes: string[];
} & typeof HTMLElement;



  elementClass: MElementClass,

  const schemaDefinition = createSchemaDefinition(schemaJSON);

  expect(elementSchema).toBeTruthy();
  expect(elementSchema.name).toEqual(elementClass.tagName);


  const schemaAttributes = new Set<string>();





  }


    const attrGroup = schemaDefinition.attributeGroups[attrGroupName];
    for (const attr of attrGroup.attributes) {



    }
  }

  // Attributes that client-side custom elements do not need to implement
  const exceptionAttributes = new Set(["id", "class", "onclick"]);


  schemaAttributes.forEach((attr: string) => {
    if (!webClientAttributes.has(attr) && !exceptionAttributes.has(attr)) {
      unobservedSchemaAttributes.push(attr);
    }
  });

  expect(unobservedSchemaAttributes).toHaveLength(0);


  webClientAttributes.forEach((attr: string) => {
    if (!schemaAttributes.has(attr)) {
      webAttributesNotInSchema.push(attr);
    }
  });








