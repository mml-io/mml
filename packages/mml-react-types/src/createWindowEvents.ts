import ts from "typescript";

import {
  createEventHandlerDeclarations,
  createEventMapInterfaceDeclaration,
} from "./createEventHandlerDeclarations";

// Hardcoding it since it doesn't seem possible to retrieve them from schema
const SCRIPT_ATTRIBUTES = [
  {
    name: "connected",
    eventName: "connected",
    eventClass: "ConnectionEvent",
  },
  {
    name: "disconnected",
    eventName: "disconnected",
    eventClass: "ConnectionEvent",
  },
];

const typeName = ts.factory.createIdentifier("WindowEventMap");

export function createWindowEventMapDeclaration() {
  const windowEventMapDeclaration = createEventMapInterfaceDeclaration(typeName, SCRIPT_ATTRIBUTES);

  return windowEventMapDeclaration;
}

export function createWindowInterfaceDeclaration() {
  const addEventListenerMethod = ts.factory.createMethodSignature(
    undefined,
    "addEventListener",
    undefined,
    [
      ts.factory.createTypeParameterDeclaration(
        undefined,
        "K",
        ts.factory.createTypeReferenceNode("keyof " + typeName.text, undefined),
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
              ts.factory.createTypeReferenceNode("Window", undefined),
            ),
            ts.factory.createParameterDeclaration(
              undefined,
              undefined,
              "ev",
              undefined,
              ts.factory.createIndexedAccessTypeNode(
                ts.factory.createTypeReferenceNode(typeName, undefined),
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
    [
      ts.factory.createTypeParameterDeclaration(
        undefined,
        "K",
        ts.factory.createTypeReferenceNode("keyof " + typeName.text, undefined),
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
              ts.factory.createTypeReferenceNode("Window", undefined),
            ),
            ts.factory.createParameterDeclaration(
              undefined,
              undefined,
              "ev",
              undefined,
              ts.factory.createIndexedAccessTypeNode(
                ts.factory.createTypeReferenceNode(typeName, undefined),
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
          ts.factory.createTypeReferenceNode("EventListenerOptions", undefined),
        ]),
      ),
    ],
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword),
  );

  const windowInstanceDeclaration = ts.factory.createInterfaceDeclaration(
    [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createIdentifier("Window"),
    undefined,
    [
      ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
        ts.factory.createExpressionWithTypeArguments(
          ts.factory.createIdentifier("EventTarget"),
          undefined,
        ),
      ]),
    ],
    [addEventListenerMethod, removeEventListenerMethod],
  );

  return windowInstanceDeclaration;
}
