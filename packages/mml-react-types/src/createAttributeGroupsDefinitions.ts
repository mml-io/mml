import { Attribute, AttributeGroup } from "@mml-io/mml-schema";
import ts from "typescript";

import {
  createEventHandlerDeclarations,
  createEventMapInterfaceDeclaration,
} from "./createEventHandlerDeclarations";
import { getAttributeGroupName, getReturnAttributeType } from "./util";

export function createAttributeGroupsDefinitions(attributeGroups: {
  [key: string]: AttributeGroup;
}): Array<ts.InterfaceDeclaration> {
  const attributeGroupDeclarations: Array<ts.InterfaceDeclaration> = [];

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
): [ts.InterfaceDeclaration, ts.InterfaceDeclaration, ts.InterfaceDeclaration?] {
  const capitalizedTypeName = getAttributeGroupName(attributeGroupName);
  const typeName = ts.factory.createIdentifier(capitalizedTypeName);

  const scriptAttributes: Array<Attribute> = [];
  const directAttributes: Array<ts.PropertySignature> = [];
  for (const attribute of attributeGroup.attributes) {
    if (attribute.type === "Script") {
      if (attribute.name === "onclick") {
        directAttributes.push(
          ts.factory.createPropertySignature(
            undefined,
            ts.factory.createIdentifier("onClick"),
            ts.factory.createToken(ts.SyntaxKind.QuestionToken),
            ts.factory.createFunctionTypeNode(
              undefined,
              [
                ts.factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  "event",
                  undefined,
                  ts.factory.createTypeReferenceNode("MMLClickEvent", undefined),
                ),
              ],
              ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword),
            ),
          ),
        );
      } else {
        scriptAttributes.push(attribute);
      }
    } else {
      directAttributes.push(
        ts.factory.createPropertySignature(
          undefined,
          ts.factory.createStringLiteral(attribute.name),
          ts.factory.createToken(ts.SyntaxKind.QuestionToken),
          ts.factory.createTypeReferenceNode(
            getReturnAttributeType(attribute),
            /*typeArguments*/ undefined,
          ),
        ),
      );
    }
  }

  let eventHandlersDeclarations: Array<ts.MethodSignature> = [];
  let eventMapInterfaceDeclaration;
  if (scriptAttributes.length > 0) {
    const eventMapTypeName = ts.factory.createIdentifier(`${capitalizedTypeName}EventMap`);
    eventMapInterfaceDeclaration = createEventMapInterfaceDeclaration(
      eventMapTypeName,
      scriptAttributes,
    );

    eventHandlersDeclarations = createEventHandlerDeclarations(eventMapTypeName);
  }

  const instanceDeclaration = ts.factory.createInterfaceDeclaration(
    [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
    typeName,
    [ts.factory.createTypeParameterDeclaration(undefined, "T")],
    undefined,
    eventHandlersDeclarations,
  );

  const attributeDeclaration = ts.factory.createInterfaceDeclaration(
    [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createIdentifier(`${capitalizedTypeName}Attributes`),
    undefined,
    undefined,
    directAttributes,
  );

  return [instanceDeclaration, attributeDeclaration, eventMapInterfaceDeclaration];
}
