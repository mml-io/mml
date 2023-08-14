import { Element } from "@mml-io/mml-schema";
import { factory, NodeFlags } from "typescript";

import { getMMLElementAttributesName } from "./util";

export function getGlobalDeclaration(elements: { [key: string]: Element }) {
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
