import { Attribute } from "@mml-io/mml-schema";
import ts from "typescript";

export function createEventHandlerDeclarations(eventMapTypeName: ts.Identifier) {
  const addEventListenerMethod = ts.factory.createMethodSignature(
    undefined,
    "addEventListener",
    undefined,
    undefined,
    [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        "type",
        undefined,
        ts.factory.createTypeReferenceNode("keyof " + eventMapTypeName.text, undefined),
      ),
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        "listener",
        undefined,
        ts.factory.createTypeReferenceNode(
          ts.factory.createIdentifier("EventListenerOrEventListenerObject"),
          undefined,
        ),
      ),
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        "options",
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        ts.factory.createUnionTypeNode([
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
          ts.factory.createTypeReferenceNode("AddEventListenerOptions", undefined),
        ]),
      ),
    ],
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword),
  );

  const addEventListenerMethodWithGenericType = ts.factory.createMethodSignature(
    undefined,
    "addEventListener",
    undefined,
    [
      ts.factory.createTypeParameterDeclaration(
        undefined,
        "K",
        ts.factory.createTypeReferenceNode("keyof " + eventMapTypeName.text, undefined),
      ),
    ],
    [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        "type",
        undefined,
        ts.factory.createTypeReferenceNode("K", undefined),
      ),
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        "listener",
        undefined,
        ts.factory.createFunctionTypeNode(
          undefined,
          [
            ts.factory.createParameterDeclaration(
              undefined,
              undefined,
              "this",
              undefined,
              ts.factory.createTypeReferenceNode("T", undefined),
            ),
            ts.factory.createParameterDeclaration(
              undefined,
              undefined,
              "ev",
              undefined,
              ts.factory.createIndexedAccessTypeNode(
                ts.factory.createTypeReferenceNode(eventMapTypeName, undefined),
                ts.factory.createTypeReferenceNode("K", undefined),
              ),
            ),
          ],
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
        ),
      ),
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        "options",
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        ts.factory.createUnionTypeNode([
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
          ts.factory.createTypeReferenceNode("AddEventListenerOptions", undefined),
        ]),
      ),
    ],
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword),
  );

  const removeEventListenerMethod = ts.factory.createMethodSignature(
    undefined,
    "removeEventListener",
    undefined,
    undefined,
    [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        "type",
        undefined,
        ts.factory.createTypeReferenceNode("keyof " + eventMapTypeName.text, undefined),
      ),
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        "listener",
        undefined,
        ts.factory.createTypeReferenceNode(
          ts.factory.createIdentifier("EventListenerOrEventListenerObject"),
          undefined,
        ),
      ),
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        "options",
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        ts.factory.createUnionTypeNode([
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
          ts.factory.createTypeReferenceNode("AddEventListenerOptions", undefined),
        ]),
      ),
    ],
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword),
  );

  const removeEventListenerMethodWithGenericType = ts.factory.createMethodSignature(
    undefined,
    "removeEventListener",
    undefined,
    [
      ts.factory.createTypeParameterDeclaration(
        undefined,
        "K",
        ts.factory.createTypeReferenceNode("keyof " + eventMapTypeName.text, undefined),
      ),
    ],
    [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        "type",
        undefined,
        ts.factory.createTypeReferenceNode("K", undefined),
      ),
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        "listener",
        undefined,
        ts.factory.createFunctionTypeNode(
          undefined,
          [
            ts.factory.createParameterDeclaration(
              undefined,
              undefined,
              "this",
              undefined,
              ts.factory.createTypeReferenceNode("T", undefined),
            ),
            ts.factory.createParameterDeclaration(
              undefined,
              undefined,
              "ev",
              undefined,
              ts.factory.createIndexedAccessTypeNode(
                ts.factory.createTypeReferenceNode(eventMapTypeName, undefined),
                ts.factory.createTypeReferenceNode("K", undefined),
              ),
            ),
          ],
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
        ),
      ),
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        "options",
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        ts.factory.createUnionTypeNode([
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
          ts.factory.createTypeReferenceNode("AddEventListenerOptions", undefined),
        ]),
      ),
    ],
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword),
  );

  return [
    addEventListenerMethodWithGenericType,
    addEventListenerMethod,
    removeEventListenerMethodWithGenericType,
    removeEventListenerMethod,
  ];
}

export function createEventMapInterfaceDeclaration(
  eventMapTypeName: ts.Identifier,
  scriptAttributes: Array<Attribute>,
) {
  return ts.factory.createInterfaceDeclaration(
    undefined,
    eventMapTypeName,
    undefined,
    undefined,
    scriptAttributes.map((attribute) => {
      const eventName = attribute.eventName as string;
      const eventClassNode = ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier(attribute.eventClass as string),
        undefined,
      );
      return ts.factory.createPropertySignature(undefined, eventName, undefined, eventClassNode);
    }),
  );
}
