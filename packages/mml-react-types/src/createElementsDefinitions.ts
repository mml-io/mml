import ts from "typescript";

const { factory, NodeFlags, NewLineKind, createPrinter, SyntaxKind } = ts;

import {
  createEventHandlersDeclarations,
  createEventMapInterfaceDeclaration,
  Element,
  Elements,
  getAttributeGroupAttributesName,
  getAttributeGroupName,
  getMMLElementAttributesName,
  getMMLElementName,
  getReturnAttributeType,
} from "./buildDeclarationFile.ts";

function getMMLElementTypeName(elementName: string): string {
  return getMMLElementName(elementName) + "Element";
}

function createElementTypes(element: Element): [unknown, unknown, unknown?, unknown?] {
  const attributes = element.attributes as Element["attributes"];
  const attributeGroupNames = element.attributeGroups as Array<string>;
  const mmlElementTypeName = getMMLElementTypeName(element.name);

  const elementAttributesWithNoScripts = attributes.filter(
    (attribute) => attribute.type !== "Script",
  );

  const hasScriptsAttributes = attributes.length !== elementAttributesWithNoScripts.length;

  let eventMapInterfaceDeclaration: ts.InterfaceDeclaration | undefined = undefined;
  let eventInstanceDeclaration: ts.InterfaceDeclaration | undefined = undefined;

  if (hasScriptsAttributes) {
    const eventMapTypeName = factory.createIdentifier(`${getMMLElementName(element.name)}EventMap`);

    eventMapInterfaceDeclaration = createEventMapInterfaceDeclaration(
      eventMapTypeName,
      element.attributes ?? [],
    );
    const eventHandlersDeclarations = createEventHandlersDeclarations(eventMapTypeName);

    eventInstanceDeclaration = factory.createInterfaceDeclaration(
      [factory.createToken(SyntaxKind.ExportKeyword)],
      getMMLElementName(element.name),
      [factory.createTypeParameterDeclaration(undefined, "T")],
      undefined,
      eventHandlersDeclarations,
    );
  }

  const directElementAttributes = elementAttributesWithNoScripts.map((attribute) => {
    const type = getReturnAttributeType(attribute);

    return factory.createPropertySignature(
      undefined,
      factory.createStringLiteral(attribute.name),
      factory.createToken(SyntaxKind.QuestionToken),
      factory.createTypeReferenceNode(type, undefined),
    );
  });

  // This is the only non-custom event we can support through react and pass as a prop
  if (element.attributeGroups.includes("clickable")) {
    directElementAttributes.push(
      factory.createPropertySignature(
        undefined,
        factory.createIdentifier("onClick"),
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createFunctionTypeNode(
          undefined,
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              "event",
              undefined,
              factory.createTypeReferenceNode("MMLClickEvent", undefined),
            ),
          ],
          factory.createKeywordTypeNode(SyntaxKind.VoidKeyword),
        ),
      ),
    );
  }

  const instanceHeritageClauses: ts.TypeReferenceNode[] = [];
  const attributeHeritageClauses: ts.TypeReferenceNode[] = [];
  attributeGroupNames
    .filter((attributeGroup) => attributeGroup !== "coreattrs")
    .forEach((attributeGroup) => {
      const attributeGroupName = getAttributeGroupName(attributeGroup);
      const typeArguments = [factory.createTypeReferenceNode(mmlElementTypeName)];
      instanceHeritageClauses.push(
        factory.createTypeReferenceNode(attributeGroupName, typeArguments),
      );

      attributeHeritageClauses.push(
        factory.createTypeReferenceNode(getAttributeGroupAttributesName(attributeGroupName)),
      );
    });

  const instanceDefaultHeritageClauses = [factory.createTypeReferenceNode("HTMLElement")];

  // create a type for each element
  const elementType = factory.createTypeAliasDeclaration(
    [factory.createToken(SyntaxKind.ExportKeyword)],
    factory.createIdentifier(mmlElementTypeName),
    undefined,
    factory.createIntersectionTypeNode(
      instanceHeritageClauses.length
        ? [
            ...instanceDefaultHeritageClauses,
            factory.createIntersectionTypeNode(instanceHeritageClauses),
          ]
        : instanceDefaultHeritageClauses,
    ),
  );

  const attributeDefaultHeritageClauses = [
    factory.createTypeReferenceNode("Coreattrs", [
      factory.createTypeReferenceNode(mmlElementTypeName),
    ]),
  ];

  const attributeType = factory.createTypeAliasDeclaration(
    [factory.createToken(SyntaxKind.ExportKeyword)],
    factory.createIdentifier(getMMLElementAttributesName(element.name)),
    undefined,
    factory.createIntersectionTypeNode(
      directElementAttributes.length
        ? [
            factory.createTypeLiteralNode(directElementAttributes),
            ...attributeDefaultHeritageClauses,
            ...attributeHeritageClauses,
          ]
        : [...attributeDefaultHeritageClauses, ...attributeHeritageClauses],
    ),
  );

  return [elementType, attributeType, eventMapInterfaceDeclaration, eventInstanceDeclaration];
}

export function createElementsDefinitions(elements: Elements) {
  const elementsDefinitions = [];

  for (const elementName in elements) {
    if (!elementName.startsWith("m-")) continue;

    const element = elements[elementName];

    const [elementType, attributeType, MapInterfaceDeclaration, eventInstanceDeclaration] =
      createElementTypes(element);

    if (MapInterfaceDeclaration) {
      elementsDefinitions.push(MapInterfaceDeclaration);
    }

    if (eventInstanceDeclaration) {
      elementsDefinitions.push(eventInstanceDeclaration);
    }

    elementsDefinitions.push(elementType, attributeType);
  }

  return elementsDefinitions;
}
