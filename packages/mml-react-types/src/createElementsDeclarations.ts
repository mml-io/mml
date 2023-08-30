import { Attribute, Element } from "@mml-io/mml-schema";
import ts from "typescript";

import {
  createEventHandlerDeclarations,
  createEventMapInterfaceDeclaration,
} from "./createEventHandlerDeclarations";
import { MMLReactCoreAttributesTypeIdentifier } from "./createReactCoreAttributesType";
import {
  getAttributeGroupAttributesName,
  getAttributeGroupName,
  getMMLElementAttributesName,
  getMMLElementName,
  getReturnAttributeType,
} from "./util";

function getMMLElementTypeName(elementName: string): string {
  return getMMLElementName(elementName) + "Element";
}

function getElementEventListenersName(name: string) {
  return getMMLElementName(name) + "EventHandlers";
}

function createElementDeclarations(element: Element): {
  eventInstanceDeclaration?: ts.InterfaceDeclaration;
  attributeType: ts.TypeAliasDeclaration;
  eventMapInterfaceDeclaration?: ts.InterfaceDeclaration;
  elementType: ts.TypeAliasDeclaration;
} {
  const attributeGroupNames = element.attributeGroups as Array<string>;
  const mmlElementTypeName = getMMLElementTypeName(element.name);

  const scriptAttributes: Array<Attribute> = [];
  const directElementAttributes: Array<ts.PropertySignature> = [];
  for (const attribute of element.attributes) {
    if (attribute.type === "Script") {
      scriptAttributes.push(attribute);
    } else {
      directElementAttributes.push(
        ts.factory.createPropertySignature(
          undefined,
          ts.factory.createStringLiteral(attribute.name),
          ts.factory.createToken(ts.SyntaxKind.QuestionToken),
          ts.factory.createTypeReferenceNode(getReturnAttributeType(attribute), undefined),
        ),
      );
    }
  }
  let eventMapInterfaceDeclaration: ts.InterfaceDeclaration | undefined = undefined;
  let eventInstanceDeclaration: ts.InterfaceDeclaration | undefined = undefined;

  const instanceHeritageClauses: Array<ts.TypeReferenceNode> = [];
  const attributeHeritageClauses: Array<ts.TypeReferenceNode> = [];
  for (const attributeGroup of attributeGroupNames) {
    const attributeGroupName = getAttributeGroupName(attributeGroup);
    const typeArguments = [ts.factory.createTypeReferenceNode(mmlElementTypeName)];
    instanceHeritageClauses.push(
      ts.factory.createTypeReferenceNode(attributeGroupName, typeArguments),
    );

    attributeHeritageClauses.push(
      ts.factory.createTypeReferenceNode(getAttributeGroupAttributesName(attributeGroupName)),
    );
  }

  if (scriptAttributes.length > 0) {
    const eventMapTypeName = ts.factory.createIdentifier(
      `${getMMLElementName(element.name)}EventMap`,
    );

    eventMapInterfaceDeclaration = createEventMapInterfaceDeclaration(
      eventMapTypeName,
      scriptAttributes,
    );
    const eventHandlersDeclarations = createEventHandlerDeclarations(eventMapTypeName);

    eventInstanceDeclaration = ts.factory.createInterfaceDeclaration(
      [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
      getElementEventListenersName(element.name),
      [ts.factory.createTypeParameterDeclaration(undefined, "T")],
      undefined,
      eventHandlersDeclarations,
    );
    const eventClassNode = ts.factory.createTypeReferenceNode(
      getElementEventListenersName(element.name),
      [ts.factory.createTypeReferenceNode(mmlElementTypeName)],
    );
    instanceHeritageClauses.push(eventClassNode);
  }

  const instanceDefaultHeritageClauses = [ts.factory.createTypeReferenceNode("HTMLElement")];

  // create a type for each element
  const elementType = ts.factory.createTypeAliasDeclaration(
    [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createIdentifier(mmlElementTypeName),
    undefined,
    ts.factory.createIntersectionTypeNode(
      instanceHeritageClauses.length
        ? [
            ...instanceDefaultHeritageClauses,
            ts.factory.createIntersectionTypeNode(instanceHeritageClauses),
          ]
        : instanceDefaultHeritageClauses,
    ),
  );

  const attributeDefaultHeritageClauses = [
    ts.factory.createTypeReferenceNode(MMLReactCoreAttributesTypeIdentifier, [
      ts.factory.createTypeReferenceNode(mmlElementTypeName),
    ]),
  ];

  const attributeType = ts.factory.createTypeAliasDeclaration(
    [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createIdentifier(getMMLElementAttributesName(element.name)),
    undefined,
    ts.factory.createIntersectionTypeNode(
      directElementAttributes.length
        ? [
            ts.factory.createTypeLiteralNode(directElementAttributes),
            ...attributeDefaultHeritageClauses,
            ...attributeHeritageClauses,
          ]
        : [...attributeDefaultHeritageClauses, ...attributeHeritageClauses],
    ),
  );

  return { elementType, attributeType, eventMapInterfaceDeclaration, eventInstanceDeclaration };
}

export function createElementsDeclarations(elements: {
  [key: string]: Element;
}): Array<ts.InterfaceDeclaration | ts.TypeAliasDeclaration> {
  const elementsDefinitions: Array<ts.InterfaceDeclaration | ts.TypeAliasDeclaration> = [];

  for (const elementName in elements) {
    if (!elementName.startsWith("m-")) continue;

    const element = elements[elementName];

    const { elementType, attributeType, eventMapInterfaceDeclaration, eventInstanceDeclaration } =
      createElementDeclarations(element);

    if (eventMapInterfaceDeclaration) {
      elementsDefinitions.push(eventMapInterfaceDeclaration);
    }

    if (eventInstanceDeclaration) {
      elementsDefinitions.push(eventInstanceDeclaration);
    }

    elementsDefinitions.push(elementType, attributeType);
  }

  return elementsDefinitions;
}
