import ts from "typescript";

const { factory, NodeFlags, NewLineKind, createPrinter, SyntaxKind } = ts;

import { format } from "prettier";

import { JSONSchema } from "./buildDeclarationFile.ts";
import { createAttributeGroupsDefinitions } from "./createAttributeGroupsDefinitions.ts";
import { createCoreAttributesType } from "./createCoreAttributesType.ts";
import { createElementsDefinitions } from "./createElementsDefinitions.ts";
import { getGlobalDeclaration } from "./getGlobalDeclaration.ts";

export function createTSDefinitionFile(schemaDefinition: JSONSchema, eventsFileContent: string) {
  // This is the import statement at the top
  const importResults: Array<any> = [];
  // This is the rest of the file
  const nodeResults: Array<any> = [];

  // This is to create the required type imports at the top of the file
  const reactImport = createReactImport();
  importResults.push(reactImport);

  // Here we create the Coreattrs interface that will be used by all elements
  const coreAttributesType = createCoreAttributesType(schemaDefinition);
  nodeResults.push(coreAttributesType);

  const { attributeGroups: attributeGroupsJSON, elements: elementsJSON } = schemaDefinition;

  // We move forward to create the attribute groups and elements definitions
  const attributeGroups = createAttributeGroupsDefinitions(attributeGroupsJSON);
  const elements = createElementsDefinitions(elementsJSON);
  nodeResults.push(...attributeGroups, ...elements);

  // We create the global declaration for the file
  const globalDeclaration = getGlobalDeclaration(elementsJSON);
  nodeResults.push(globalDeclaration);

  // We create the printer to print the file
  const printer = createPrinter({
    newLine: NewLineKind.LineFeed,
  });

  // We create the AST for the file
  factory.createNodeArray(nodeResults);

  // We create a source file for the imports
  const importFile = factory.createSourceFile(
    importResults,
    factory.createToken(SyntaxKind.EndOfFileToken),
    NodeFlags.None,
  );

  // We create a source file for the rest of the file
  const resultFile = factory.createSourceFile(
    nodeResults,
    factory.createToken(SyntaxKind.EndOfFileToken),
    NodeFlags.None,
  );

  // We print the files
  const rawImportFile = printer.printFile(importFile);
  const rawFile = printer.printFile(resultFile);

  // This is to change global to declare global. It doesn't see to be possible to do it with the AST
  const sourceCodeWithDeclare = rawFile.replace("global", "declare global");

  // We combine the import file, the event file coming from the events.ts file and the rest of the file
  const fileCombinedWithEvents =
    rawImportFile + "\n" + eventsFileContent + "\n" + sourceCodeWithDeclare;

  // We prettify the file with prettier, changing the tab width to 2 and adding trailing commas
  const prettified = format(fileCombinedWithEvents, {
    parser: "typescript",
    printWidth: 120,
    tabWidth: 2,
    trailingComma: "all",
  });

  return prettified;
}

function createReactImport() {
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
