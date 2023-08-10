import ts from "typescript";

const { factory, NodeFlags, NewLineKind, createPrinter, SyntaxKind } = ts;

import {
  Elements,
  getMMLElementAttributesName,
  getMMLElementName,
} from "./buildDeclarationFile.ts";

// Todo: Split types between react core attributes and MML core attributes
export function getGlobalDeclaration(elements: Elements) {
  return factory.createModuleDeclaration(
    undefined,
    factory.createIdentifier("global"),
    factory.createModuleBlock([
      factory.createModuleDeclaration(
        undefined,
        factory.createIdentifier("JSX"),
        factory.createModuleBlock([
          factory.createInterfaceDeclaration(
            undefined,
            factory.createIdentifier("IntrinsicElements"),
            undefined,
            undefined,
            Object.keys(elements)
              .filter((elementName) => elementName.startsWith("m-"))
              .map((elementName) =>
                factory.createPropertySignature(
                  undefined,
                  factory.createComputedPropertyName(factory.createStringLiteral(elementName)),
                  undefined,
                  factory.createTypeReferenceNode(
                    getMMLElementAttributesName(elementName),
                    undefined,
                  ),
                ),
              ),
          ),
        ]),
        NodeFlags.Namespace,
      ),
    ]),
    NodeFlags.GlobalAugmentation,
  );
}
