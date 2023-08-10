import ts from "typescript";

import {
  AttributeGroup,
  AttributeGroups,
  createEventHandlersDeclarations,
  createEventMapInterfaceDeclaration,
  getAttributeGroupName,
  getReturnAttributeType,
} from "./buildDeclarationFile.ts";

const { factory, NodeFlags, NewLineKind, createPrinter, SyntaxKind } = ts;

export function createAttributeGroupsDefinitions(attributes: AttributeGroups) {
  const attributeGroups = [];

  for (const attributeGroupName in attributes) {
    // we skip coreattrs because we handle it separately
    if (attributeGroupName === "coreattrs") continue;

    const attributeGroup = attributes[attributeGroupName];
    const [instanceDeclaration, attributeDeclaration, eventMapInterfaceDeclaration] =
      createAttributeGroupDeclarations(attributeGroupName, attributeGroup);
    attributeGroups.push(instanceDeclaration, attributeDeclaration);
    if (eventMapInterfaceDeclaration) {
      attributeGroups.push(eventMapInterfaceDeclaration);
    }
  }

  return attributeGroups;
}

function createAttributeGroupDeclarations(
  attributeGroupName: string,
  attributeGroup: AttributeGroup,
) {
  const capitalizedTypeName = getAttributeGroupName(attributeGroupName);
  const typeName = factory.createIdentifier(capitalizedTypeName);

  const attributesWithoutScripts = (attributeGroup.attributes || []).filter(
    (attribute) => attribute.type !== "Script",
  );

  const attributeGroupAttributes: any[] = (attributesWithoutScripts || []).map((attribute) => {
    const type = getReturnAttributeType(attribute);

    const typeNode = factory.createTypeReferenceNode(type, /*typeArguments*/ undefined);

    return factory.createPropertySignature(
      undefined,
      // can we create this with the factory methods?
      factory.createStringLiteral(attribute.name),
      factory.createToken(SyntaxKind.QuestionToken),
      typeNode,
    );
  });

  let eventHandlersDeclarations: ts.MethodSignature[] = [];

  const eventMapTypeName = factory.createIdentifier(`${capitalizedTypeName}EventMap`);

  let eventMapInterfaceDeclaration;

  const hasScriptAttributes = attributesWithoutScripts.length !== attributeGroup.attributes?.length;

  if (hasScriptAttributes) {
    eventMapInterfaceDeclaration = createEventMapInterfaceDeclaration(
      eventMapTypeName,
      attributeGroup.attributes ?? [],
    );

    eventHandlersDeclarations = createEventHandlersDeclarations(eventMapTypeName);
  }

  const instanceDeclaration = factory.createInterfaceDeclaration(
    [factory.createToken(SyntaxKind.ExportKeyword)],
    typeName,
    [factory.createTypeParameterDeclaration(undefined, "T")],
    undefined,
    eventHandlersDeclarations,
  );

  const attributeDeclaration = factory.createInterfaceDeclaration(
    [factory.createToken(SyntaxKind.ExportKeyword)],
    factory.createIdentifier(`${capitalizedTypeName}Attributes`),
    undefined,
    undefined,
    attributeGroupAttributes,
  );

  return [instanceDeclaration, attributeDeclaration, eventMapInterfaceDeclaration];
}
