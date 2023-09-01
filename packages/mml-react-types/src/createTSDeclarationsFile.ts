import { SchemaDefinition } from "@mml-io/mml-schema";
import { format } from "prettier";
import ts from "typescript";

import { createAttributeGroupsDefinitions } from "./createAttributeGroupsDefinitions";
import { createElementsDeclarations } from "./createElementsDeclarations";
import { createReactCoreAttributesType } from "./createReactCoreAttributesType";
import { getGlobalDeclaration } from "./getGlobalDeclaration";

export function createTSDeclarationsFile(
  schemaDefinition: SchemaDefinition,
  eventsFileContent: string,
): Promise<string> {
  // This is the rest of the file
  const declarationStatements: Array<ts.Statement> = [];

  // Here we create an interface that will be used by all elements (ref etc.)
  const coreAttributesType = createReactCoreAttributesType();
  declarationStatements.push(coreAttributesType);

  const { attributeGroups: attributeGroupsJSON, elements: elementsJSON } = schemaDefinition;

  // We move forward to create the attribute groups and elements definitions
  const attributeGroups = createAttributeGroupsDefinitions(attributeGroupsJSON);
  const elements = createElementsDeclarations(elementsJSON);
  declarationStatements.push(...attributeGroups, ...elements);

  // We create the global declaration for the file
  const globalDeclaration = getGlobalDeclaration(elementsJSON);
  declarationStatements.push(globalDeclaration);

  // We create the AST for the file
  ts.factory.createNodeArray(declarationStatements);

  // We create a source file for the imports of React at the top of the file
  const importFile = ts.factory.createSourceFile(
    [createReactImport()],
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );

  // We create a source file for the rest of the file
  const declarationsFile = ts.factory.createSourceFile(
    declarationStatements,
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );

  // We print the files
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
  });
  const rawImportFile = printer.printFile(importFile);
  const rawFile = printer.printFile(declarationsFile);

  // This is to change global to declare global. It doesn't see to be possible to do it with the AST
  const sourceCodeWithDeclare = rawFile.replace("global", "declare global");

  // We combine the import file, the event file coming from the events.ts file and the rest of the file
  const fileCombinedWithEvents =
    rawImportFile + "\n" + eventsFileContent + "\n" + sourceCodeWithDeclare;

  // We prettify the file with prettier, changing the tab width to 2 and adding trailing commas
  return format(fileCombinedWithEvents, {
    parser: "typescript",
    printWidth: 120,
    tabWidth: 2,
    trailingComma: "all",
  });
}

function createReactImport(): ts.ImportDeclaration {
  // This returns import { LegacyRef, ReactNode } from "react";
  return ts.factory.createImportDeclaration(
    /*modifiers*/ undefined,
    ts.factory.createImportClause(
      /*isTypeOnly*/ false,
      /*name*/ undefined,
      ts.factory.createNamedImports([
        ts.factory.createImportSpecifier(
          true,
          /*propertyName*/ undefined,
          ts.factory.createIdentifier("LegacyRef"),
        ),
        ts.factory.createImportSpecifier(
          true,
          /*propertyName*/ undefined,
          ts.factory.createIdentifier("ReactNode"),
        ),
      ]),
    ),
    ts.factory.createStringLiteral("react"),
  );
}
