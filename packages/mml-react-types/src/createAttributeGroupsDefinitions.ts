import { Attribute, AttributeGroup } from "@mml-io/mml-schema";
import {
  factory,
  InterfaceDeclaration,
  MethodSignature,
  PropertySignature,
  SyntaxKind,
} from "typescript";

import {
  createEventHandlerDeclarations,
  createEventMapInterfaceDeclaration,
} from "./createEventHandlerDeclarations";
import { getAttributeGroupName, getReturnAttributeType } from "./util";

export function createAttributeGroupsDefinitions(attributeGroups: {
  [key: string]: AttributeGroup;
}): Array<InterfaceDeclaration> {
  const attributeGroupDeclarations: Array<InterfaceDeclaration> = [];

  for (const attributeGroupName in attributeGroups) {
    const attributeGroup = attributeGroups[attributeGroupName];
    const [instanceDeclaration, attributeDeclaration, eventMapInterfaceDeclaration] =
      createAttributeGroupDeclarations(attributeGroupName, attributeGroup);
    attributeGroupDeclarations.push(instanceDeclaration, attributeDeclaration);
    if (eventMapInterfaceDeclaration) {
      attributeGroupDeclarations.push(eventMapInterfaceDeclaration);
    }
  }

  return attributeGroupDeclarations;
}

function createAttributeGroupDeclarations(
  attributeGroupName: string,
  attributeGroup: AttributeGroup,
): [InterfaceDeclaration, InterfaceDeclaration, InterfaceDeclaration?] {
  const capitalizedTypeName = getAttributeGroupName(attributeGroupName);
  const typeName = factory.createIdentifier(capitalizedTypeName);

  const scriptAttributes: Array<Attribute> = [];
  const directAttributes: Array<PropertySignature> = [];
  for (const attribute of attributeGroup.attributes) {
    if (attribute.type === "Script") {
      if (attribute.name === "onclick") {
        directAttributes.push(
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
      } else {
        scriptAttributes.push(attribute);
      }
    } else {
      directAttributes.push(
        factory.createPropertySignature(
          undefined,
          factory.createStringLiteral(attribute.name),
          factory.createToken(SyntaxKind.QuestionToken),
          factory.createTypeReferenceNode(
            getReturnAttributeType(attribute),
            /*typeArguments*/ undefined,
          ),
        ),
      );
    }
  }

  let eventHandlersDeclarations: Array<MethodSignature> = [];
  let eventMapInterfaceDeclaration;
  if (scriptAttributes.length > 0) {
    const eventMapTypeName = factory.createIdentifier(`${capitalizedTypeName}EventMap`);
    eventMapInterfaceDeclaration = createEventMapInterfaceDeclaration(
      eventMapTypeName,
      scriptAttributes,
    );

    eventHandlersDeclarations = createEventHandlerDeclarations(eventMapTypeName);
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
    directAttributes,
  );

  return [instanceDeclaration, attributeDeclaration, eventMapInterfaceDeclaration];
}
