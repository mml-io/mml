import { Attribute } from "@mml-io/mml-schema";
import { factory, Identifier, SyntaxKind } from "typescript";

export function createEventHandlerDeclarations(eventMapTypeName: Identifier) {
  const addEventListenerMethod = factory.createMethodSignature(
    undefined,
    "addEventListener",
    undefined,
    undefined,
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        "type",
        undefined,
        factory.createTypeReferenceNode("keyof " + eventMapTypeName.text, undefined),
      ),
      factory.createParameterDeclaration(
        undefined,
        undefined,
        "listener",
        undefined,
        factory.createTypeReferenceNode(
          factory.createIdentifier("EventListenerOrEventListenerObject"),
          undefined,
        ),
      ),
      factory.createParameterDeclaration(
        undefined,
        undefined,
        "options",
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createUnionTypeNode([
          factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword),
          factory.createTypeReferenceNode("AddEventListenerOptions", undefined),
        ]),
      ),
    ],
    factory.createKeywordTypeNode(SyntaxKind.VoidKeyword),
  );

  const addEventListenerMethodWithGenericType = factory.createMethodSignature(
    undefined,
    "addEventListener",
    undefined,
    [
      factory.createTypeParameterDeclaration(
        undefined,
        "K",
        factory.createTypeReferenceNode("keyof " + eventMapTypeName.text, undefined),
      ),
    ],
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        "type",
        undefined,
        factory.createTypeReferenceNode("K", undefined),
      ),
      factory.createParameterDeclaration(
        undefined,
        undefined,
        "listener",
        undefined,
        factory.createFunctionTypeNode(
          undefined,
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              "this",
              undefined,
              factory.createTypeReferenceNode("T", undefined),
            ),
            factory.createParameterDeclaration(
              undefined,
              undefined,
              "ev",
              undefined,
              factory.createIndexedAccessTypeNode(
                factory.createTypeReferenceNode(eventMapTypeName, undefined),
                factory.createTypeReferenceNode("K", undefined),
              ),
            ),
          ],
          factory.createKeywordTypeNode(SyntaxKind.AnyKeyword),
        ),
      ),
      factory.createParameterDeclaration(
        undefined,
        undefined,
        "options",
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createUnionTypeNode([
          factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword),
          factory.createTypeReferenceNode("AddEventListenerOptions", undefined),
        ]),
      ),
    ],
    factory.createKeywordTypeNode(SyntaxKind.VoidKeyword),
  );

  const removeEventListenerMethod = factory.createMethodSignature(
    undefined,
    "removeEventListener",
    undefined,
    undefined,
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        "type",
        undefined,
        factory.createTypeReferenceNode("keyof " + eventMapTypeName.text, undefined),
      ),
      factory.createParameterDeclaration(
        undefined,
        undefined,
        "listener",
        undefined,
        factory.createTypeReferenceNode(
          factory.createIdentifier("EventListenerOrEventListenerObject"),
          undefined,
        ),
      ),
      factory.createParameterDeclaration(
        undefined,
        undefined,
        "options",
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createUnionTypeNode([
          factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword),
          factory.createTypeReferenceNode("AddEventListenerOptions", undefined),
        ]),
      ),
    ],
    factory.createKeywordTypeNode(SyntaxKind.VoidKeyword),
  );

  const removeEventListenerMethodWithGenericType = factory.createMethodSignature(
    undefined,
    "removeEventListener",
    undefined,
    [
      factory.createTypeParameterDeclaration(
        undefined,
        "K",
        factory.createTypeReferenceNode("keyof " + eventMapTypeName.text, undefined),
      ),
    ],
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        "type",
        undefined,
        factory.createTypeReferenceNode("K", undefined),
      ),
      factory.createParameterDeclaration(
        undefined,
        undefined,
        "listener",
        undefined,
        factory.createFunctionTypeNode(
          undefined,
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              "this",
              undefined,
              factory.createTypeReferenceNode("T", undefined),
            ),
            factory.createParameterDeclaration(
              undefined,
              undefined,
              "ev",
              undefined,
              factory.createIndexedAccessTypeNode(
                factory.createTypeReferenceNode(eventMapTypeName, undefined),
                factory.createTypeReferenceNode("K", undefined),
              ),
            ),
          ],
          factory.createKeywordTypeNode(SyntaxKind.AnyKeyword),
        ),
      ),
      factory.createParameterDeclaration(
        undefined,
        undefined,
        "options",
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createUnionTypeNode([
          factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword),
          factory.createTypeReferenceNode("AddEventListenerOptions", undefined),
        ]),
      ),
    ],
    factory.createKeywordTypeNode(SyntaxKind.VoidKeyword),
  );

  return [
    addEventListenerMethodWithGenericType,
    addEventListenerMethod,
    removeEventListenerMethodWithGenericType,
    removeEventListenerMethod,
  ];
}

export function createEventMapInterfaceDeclaration(
  eventMapTypeName: Identifier,
  scriptAttributes: Array<Attribute>,
) {
  return factory.createInterfaceDeclaration(
    undefined,
    eventMapTypeName,
    undefined,
    undefined,
    scriptAttributes.map((attribute) => {
      const eventName = attribute.eventName as string;
      const eventClassNode = factory.createTypeReferenceNode(
        factory.createIdentifier(attribute.eventClass as string),
        undefined,
      );
      return factory.createPropertySignature(undefined, eventName, undefined, eventClassNode);
    }),
  );
}
