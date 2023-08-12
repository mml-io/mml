import { Attribute, Element } from "@mml-io/mml-schema";
import {
  factory,
  InterfaceDeclaration,
  PropertySignature,
  SyntaxKind,
  TypeAliasDeclaration,
  TypeReferenceNode,
} from "typescript";

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
  eventInstanceDeclaration?: InterfaceDeclaration;
  attributeType: TypeAliasDeclaration;
  eventMapInterfaceDeclaration?: InterfaceDeclaration;
  elementType: TypeAliasDeclaration;
} {
  const attributeGroupNames = element.attributeGroups as Array<string>;
  const mmlElementTypeName = getMMLElementTypeName(element.name);

  const scriptAttributes: Array<Attribute> = [];
  const directElementAttributes: Array<PropertySignature> = [];
  for (const attribute of element.attributes) {
    if (attribute.type === "Script") {
      scriptAttributes.push(attribute);
    } else {
      directElementAttributes.push(
        factory.createPropertySignature(
          undefined,
          factory.createStringLiteral(attribute.name),
          factory.createToken(SyntaxKind.QuestionToken),
          factory.createTypeReferenceNode(getReturnAttributeType(attribute), undefined),
        ),
      );
    }
  }
  let eventMapInterfaceDeclaration: InterfaceDeclaration | undefined = undefined;
  let eventInstanceDeclaration: InterfaceDeclaration | undefined = undefined;

  const instanceHeritageClauses: Array<TypeReferenceNode> = [];
  const attributeHeritageClauses: Array<TypeReferenceNode> = [];
  for (const attributeGroup of attributeGroupNames) {
    const attributeGroupName = getAttributeGroupName(attributeGroup);
    const typeArguments = [factory.createTypeReferenceNode(mmlElementTypeName)];
    instanceHeritageClauses.push(
      factory.createTypeReferenceNode(attributeGroupName, typeArguments),
    );

    attributeHeritageClauses.push(
      factory.createTypeReferenceNode(getAttributeGroupAttributesName(attributeGroupName)),
    );
  }

  if (scriptAttributes.length > 0) {
    const eventMapTypeName = factory.createIdentifier(`${getMMLElementName(element.name)}EventMap`);

    eventMapInterfaceDeclaration = createEventMapInterfaceDeclaration(
      eventMapTypeName,
      scriptAttributes,
    );
    const eventHandlersDeclarations = createEventHandlerDeclarations(eventMapTypeName);

    eventInstanceDeclaration = factory.createInterfaceDeclaration(
      [factory.createToken(SyntaxKind.ExportKeyword)],
      getElementEventListenersName(element.name),
      [factory.createTypeParameterDeclaration(undefined, "T")],
      undefined,
      eventHandlersDeclarations,
    );
    const eventClassNode = factory.createTypeReferenceNode(
      getElementEventListenersName(element.name),
      [factory.createTypeReferenceNode(mmlElementTypeName)],
    );
    instanceHeritageClauses.push(eventClassNode);
  }

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
    factory.createTypeReferenceNode(MMLReactCoreAttributesTypeIdentifier, [
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

  return { elementType, attributeType, eventMapInterfaceDeclaration, eventInstanceDeclaration };
}

export function createElementsDeclarations(elements: {
  [key: string]: Element;
}): Array<InterfaceDeclaration | TypeAliasDeclaration> {
  const elementsDefinitions: Array<InterfaceDeclaration | TypeAliasDeclaration> = [];

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
