import { SchemaDefinition } from "@mml-io/mml-schema";
import { format } from "prettier";
import {
  createPrinter,
  factory,
  ImportDeclaration,
  NewLineKind,
  NodeFlags,
  Statement,
  SyntaxKind,
} from "typescript";

import { createAttributeGroupsDefinitions } from "./createAttributeGroupsDefinitions";
import { createElementsDeclarations } from "./createElementsDeclarations";
import { createReactCoreAttributesType } from "./createReactCoreAttributesType";
import { getGlobalDeclaration } from "./getGlobalDeclaration";

export function createTSDeclarationsFile(
  schemaDefinition: SchemaDefinition,
  eventsFileContent: string,
): string {
  // This is the rest of the file
  const declarationStatements: Array<Statement> = [];

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
  factory.createNodeArray(declarationStatements);

  // We create a source file for the imports of React at the top of the file
  const importFile = factory.createSourceFile(
    [createReactImport()],
    factory.createToken(SyntaxKind.EndOfFileToken),
    NodeFlags.None,
  );

  // We create a source file for the rest of the file
  const declarationsFile = factory.createSourceFile(
    declarationStatements,
    factory.createToken(SyntaxKind.EndOfFileToken),
    NodeFlags.None,
  );

  // We print the files
  const printer = createPrinter({
    newLine: NewLineKind.LineFeed,
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

function createReactImport(): ImportDeclaration {
  // This returns import { LegacyRef, ReactNode } from "react";
  return factory.createImportDeclaration(
    /*modifiers*/ undefined,
    factory.createImportClause(
      /*isTypeOnly*/ false,
      /*name*/ undefined,
      factory.createNamedImports([
        factory.createImportSpecifier(
          true,
          /*propertyName*/ undefined,
          factory.createIdentifier("LegacyRef"),
        ),
        factory.createImportSpecifier(
          true,
          /*propertyName*/ undefined,
          factory.createIdentifier("ReactNode"),
        ),
      ]),
    ),
    factory.createStringLiteral("react"),
  );
}
