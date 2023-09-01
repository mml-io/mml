import { Element } from "@mml-io/mml-schema";
import ts from "typescript";

import { getMMLElementAttributesName } from "./util";

export function getGlobalDeclaration(elements: { [key: string]: Element }) {
  return ts.factory.createModuleDeclaration(
    undefined,
    ts.factory.createIdentifier("global"),
    ts.factory.createModuleBlock([
      ts.factory.createModuleDeclaration(
        undefined,
        ts.factory.createIdentifier("JSX"),
        ts.factory.createModuleBlock([
          ts.factory.createInterfaceDeclaration(
            undefined,
            ts.factory.createIdentifier("IntrinsicElements"),
            undefined,
            undefined,
            Object.keys(elements)
              .filter((elementName) => elementName.startsWith("m-"))
              .map((elementName) =>
                ts.factory.createPropertySignature(
                  undefined,
                  ts.factory.createComputedPropertyName(
                    ts.factory.createStringLiteral(elementName),
                  ),
                  undefined,
                  ts.factory.createTypeReferenceNode(
                    getMMLElementAttributesName(elementName),
                    undefined,
                  ),
                ),
              ),
          ),
        ]),
        ts.NodeFlags.Namespace,
      ),
    ]),
    ts.NodeFlags.GlobalAugmentation,
  );
}
