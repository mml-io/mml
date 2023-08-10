import ts from "typescript";

const { factory, NodeFlags, NewLineKind, createPrinter, SyntaxKind } = ts;

import { getReturnAttributeType, JSONSchema } from "./buildDeclarationFile.ts";

export function createCoreAttributesType(schemaJSON: JSONSchema) {
  // We add a few types used by React for all elements then add the core attributes for MML
  return factory.createInterfaceDeclaration(
    undefined,
    factory.createIdentifier("Coreattrs"),
    // add generic T to the interface
    [factory.createTypeParameterDeclaration(undefined, "T")],
    undefined,
    [
      factory.createPropertySignature(
        undefined,
        factory.createIdentifier("key"),
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createTypeReferenceNode("string | number", undefined),
      ),
      factory.createPropertySignature(
        undefined,
        factory.createIdentifier("children"),
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createTypeReferenceNode("ReactNode | undefined", undefined),
      ),
      factory.createPropertySignature(
        undefined,
        factory.createIdentifier("ref"),
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createTypeReferenceNode("LegacyRef<T>", undefined),
      ),
      // MML Core attributes
      ...schemaJSON.attributeGroups.coreattrs.attributes!.map((attribute) => {
        const type = getReturnAttributeType(attribute);

        const typeNode = factory.createTypeReferenceNode(type, /*typeArguments*/ undefined);

        return factory.createPropertySignature(
          undefined,
          factory.createStringLiteral(attribute.name),
          factory.createToken(SyntaxKind.QuestionToken),
          typeNode,
        );
      }),
    ],
  );
}
