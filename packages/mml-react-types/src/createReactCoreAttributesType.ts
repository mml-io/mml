import ts from "typescript";

export const MMLReactCoreAttributesTypeIdentifier = "MMLReactCoreAttributes";

export function createReactCoreAttributesType() {
  // We add a few types used by React for all elements then add the core attributes for MML
  return ts.factory.createInterfaceDeclaration(
    undefined,
    ts.factory.createIdentifier(MMLReactCoreAttributesTypeIdentifier),
    // add generic T to the interface
    [ts.factory.createTypeParameterDeclaration(undefined, "T")],
    undefined,
    [
      ts.factory.createPropertySignature(
        undefined,
        ts.factory.createIdentifier("key"),
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        ts.factory.createTypeReferenceNode("string | number", undefined),
      ),
      ts.factory.createPropertySignature(
        undefined,
        ts.factory.createIdentifier("children"),
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        ts.factory.createTypeReferenceNode("ReactNode | undefined", undefined),
      ),
      ts.factory.createPropertySignature(
        undefined,
        ts.factory.createIdentifier("ref"),
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        ts.factory.createTypeReferenceNode("LegacyRef<T>", undefined),
      ),
    ],
  );
}
