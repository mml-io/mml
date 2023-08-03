import fs from "fs";

import { format } from "prettier";
import * as ts from "typescript";

function addQuotesIfNecessary(str: string): string {
  // The regular expression checks if str contains any characters other than
  // alphanumeric characters and underscores.
  if (/[^A-Za-z0-9_]/.test(str)) {
    return `"${str}"`;
  }
  return str;
}

function getReturnAttributeType(attribute: Elements[string]["attributes"][number]) {
  if (attribute.enum) {
    return `${attribute.enum.map((e) => `"${e}"`).join(" | ")}`;
  }

  const attributeType = schemaToTSTypeMap[attribute.type as keyof typeof schemaToTSTypeMap];
  if (["() => void", "string"].includes(attributeType)) {
    return attributeType;
  }

  return attributeType + " | string";
}

const schemaToTSTypeMap = {
  "xs:ID": "string",
  "xs:NMTOKENS": "string",
  // TODO: Proper handling once we get events
  Script: "() => void",
  "xs:float": "number",
  "xs:int": "number",
  "xs:integer": "number",
  "xs:string": "string",
  "xs:boolean": "boolean",
  URI: "string",
} as const;

const attributesInterfaceToSchemaNameMap: Record<
  string,
  {
    name: string;
    hasInstance?: boolean;
    hasAttributes?: boolean;
  }
> = {};

const elementsInterfaceToSchemaNameMap: Record<string, string> = {};

type AttributeGroups = {
  [attributeGroupName: string]: {
    attributes?: Array<{
      name: string;
      type: keyof typeof schemaToTSTypeMap;
    }>;
  };
};
export type Elements = {
  [elementName: string]: {
    name: string;
    attributes: Array<{
      name: string;
      type?: keyof typeof schemaToTSTypeMap;
      description?: string[];
      enum?: string[];
    }>;
    attributeGroups: string[];
    description: string[];
  };
};
export type JSONSchema = {
  elements: Elements;
  attributeGroups: AttributeGroups;
};

function getMMLElementName(elementName: string) {
  // first we split the name by dashes
  const splittedName = elementName.split("-");
  const capitalizedTypeName = splittedName
    // exclude the first element which is always "m"
    .slice(1)
    // capitalize each word
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    // join the words
    .join("");
  return "M" + capitalizedTypeName;
}

function createAttributeGroupsDefinitions(attributes: AttributeGroups) {
  const attributeGroups = [];

  for (const attributeGroupName in attributes) {
    // we skip coreattrs because we handle it separately
    if (attributeGroupName === "coreattrs") continue;

    const attributeGroup = attributes[attributeGroupName];

    const capitalizedTypeName =
      attributeGroupName.charAt(0).toUpperCase() + attributeGroupName.slice(1);
    const typeName = ts.factory.createIdentifier(capitalizedTypeName);

    const attributesWithoutScripts = (attributeGroup.attributes || []).filter(
      (attribute) => attribute.type !== "Script",
    );

    const hasScriptAttributes =
      attributesWithoutScripts.length !== attributeGroup.attributes?.length;

    const members: any[] = (attributesWithoutScripts || []).map((attribute) => {
      const name = addQuotesIfNecessary(attribute.name);
      const type = getReturnAttributeType(attribute);

      const typeNode = ts.factory.createTypeReferenceNode(type, /*typeArguments*/ undefined);

      return ts.factory.createPropertySignature(
        undefined,
        name,
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        typeNode,
      );
    });

    if (hasScriptAttributes) {
      const eventMapTypeName = ts.factory.createIdentifier(`${capitalizedTypeName}EventMap`);

      const eventMapInterfaceDeclaration = ts.factory.createInterfaceDeclaration(
        undefined,
        eventMapTypeName,
        undefined,
        undefined,
        (attributeGroup.attributes || [])
          .filter((attribute) => attribute.type === "Script")
          .map((attribute) => {
            const eventName = attribute.name.replace(/^on/, "");
            const eventTypeNode = ts.factory.createTypeReferenceNode(
              ts.factory.createIdentifier(
                `${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}Event`,
              ),
              undefined,
            );
            return ts.factory.createPropertySignature(
              undefined,
              eventName,
              undefined,
              eventTypeNode,
            );
          }),
      );

      attributeGroups.push(eventMapInterfaceDeclaration);

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

      const addEventListenerMethodWithoutThis = ts.factory.createMethodSignature(
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
                    ts.factory.createTypeReferenceNode("keyof " + eventMapTypeName.text, undefined),
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

      const removeEventListenerMethodWithoutThis = ts.factory.createMethodSignature(
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
                    ts.factory.createTypeReferenceNode("keyof " + eventMapTypeName.text, undefined),
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

      // We'll omit removeEventListener for brevity but it's created in a similar way
      //const removeEventListenerMethod = ...

      const instanceDeclaration = ts.factory.createInterfaceDeclaration(
        undefined,
        typeName,
        [ts.factory.createTypeParameterDeclaration(undefined, "T")],
        undefined,
        [
          addEventListenerMethodWithoutThis,
          addEventListenerMethod,
          removeEventListenerMethodWithoutThis,
          removeEventListenerMethod,
        ],
      );

      attributeGroups.push(instanceDeclaration);
    }

    attributesInterfaceToSchemaNameMap[attributeGroupName] = {
      name: capitalizedTypeName,
      hasInstance: hasScriptAttributes,
    };

    if (members.length) {
      const attributeDeclaration = ts.factory.createInterfaceDeclaration(
        undefined,
        ts.factory.createIdentifier(`${capitalizedTypeName}Attributes`),
        undefined,
        undefined,
        members,
      );
      attributesInterfaceToSchemaNameMap[attributeGroupName].hasAttributes = true;
      attributeGroups.push(attributeDeclaration);
    }
  }

  return attributeGroups;
}

function createElementsDefinitions(elements: Elements) {
  const elementsDefinitions = [];

  for (const elementName in elements) {
    if (!elementName.startsWith("m-")) continue;

    const element = elements[elementName];

    const attributes = element.attributes as Elements["m-foo"]["attributes"];
    const attributeGroups = element.attributeGroups as Array<string>;
    const name = getMMLElementName(element.name);

    elementsInterfaceToSchemaNameMap[element.name] = name;

    const members = attributes.map((attribute) => {
      const type = getReturnAttributeType(attribute);

      return ts.factory.createPropertySignature(
        undefined,
        ts.factory.createIdentifier(addQuotesIfNecessary(attribute.name)),
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        ts.factory.createTypeReferenceNode(type, undefined),
      );
    });

    const { instanceHeritageClauses, attributeHeritageClauses } = attributeGroups
      .filter((attributeGroup) => attributeGroup !== "coreattrs")
      .reduce(
        (result, attributeGroup) => {
          const {
            name: attributeName,
            hasInstance,
            hasAttributes,
          } = attributesInterfaceToSchemaNameMap[attributeGroup];

          if (hasInstance) {
            const typeArguments = [ts.factory.createTypeReferenceNode(name + "Element")];
            result.instanceHeritageClauses.push(
              ts.factory.createTypeReferenceNode(attributeName, typeArguments),
            );
          }

          if (hasAttributes) {
            result.attributeHeritageClauses.push(
              ts.factory.createTypeReferenceNode(attributeName + "Attributes"),
            );
          }
          return result;
        },
        { instanceHeritageClauses: [], attributeHeritageClauses: [] } as {
          instanceHeritageClauses: any[];
          attributeHeritageClauses: any[];
        },
      );

    const instanceDefaultHeritageClauses = [ts.factory.createTypeReferenceNode("HTMLElement")];

    // create a type for each element
    const elementType = ts.factory.createTypeAliasDeclaration(
      undefined,
      ts.factory.createIdentifier(name + "Element"),
      undefined,
      ts.factory.createIntersectionTypeNode(
        instanceHeritageClauses.length
          ? [
              ...instanceDefaultHeritageClauses,
              ts.factory.createIntersectionTypeNode(instanceHeritageClauses),
            ]
          : instanceDefaultHeritageClauses,
      ),
    );

    elementsDefinitions.push(elementType);

    const attributeDefaultHeritageClauses = [
      ts.factory.createTypeReferenceNode("Coreattrs", [
        ts.factory.createTypeReferenceNode(name + "Element"),
      ]),
    ];

    const attributeType = ts.factory.createTypeAliasDeclaration(
      undefined,
      ts.factory.createIdentifier(name + "Attributes"),
      undefined,
      ts.factory.createIntersectionTypeNode(
        members.length
          ? [
              ts.factory.createTypeLiteralNode(members),
              ...attributeDefaultHeritageClauses,
              ...attributeHeritageClauses,
            ]
          : [...attributeDefaultHeritageClauses, ...attributeHeritageClauses],
      ),
    );

    elementsDefinitions.push(attributeType);
  }

  return elementsDefinitions;
}

function createReactImport() {
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

function createCoreAttributesType(schemaJSON: JSONSchema) {
  // We take what's in the schema and then add a few extra types used by React
  return ts.factory.createInterfaceDeclaration(
    undefined,
    ts.factory.createIdentifier("Coreattrs"),
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
      ...schemaJSON.attributeGroups.coreattrs.attributes!.map((attribute) => {
        const name = addQuotesIfNecessary(attribute.name);
        const type = getReturnAttributeType(attribute);

        const typeNode = ts.factory.createTypeReferenceNode(type, /*typeArguments*/ undefined);

        return ts.factory.createPropertySignature(
          undefined,
          name,
          ts.factory.createToken(ts.SyntaxKind.QuestionToken),
          typeNode,
        );
      }),
    ],
  );
}

function getGlobalDeclaration(elements: Elements) {
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
              .filter((element) => element.startsWith("m-"))
              .map((element) =>
                ts.factory.createIndexSignature(
                  undefined,
                  [
                    ts.factory.createParameterDeclaration(
                      undefined,
                      undefined,
                      ts.factory.createIdentifier(addQuotesIfNecessary(element)),
                      undefined,
                      undefined,
                      undefined,
                    ),
                  ],
                  ts.factory.createTypeReferenceNode(
                    elementsInterfaceToSchemaNameMap[element] + "Attributes",
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

export function createTSDefinitionFile(schemaDefinition: JSONSchema) {
  const nodeResults: Array<any> = [];

  // This is to create the required type imports at the top of the file
  const reactImport = createReactImport();
  nodeResults.push(reactImport);

  // Here we create the Coreattrs interface that will be used by all elements
  const coreAttributesType = createCoreAttributesType(schemaDefinition);

  nodeResults.push(coreAttributesType);

  const { attributeGroups: attributeGroupsJSON, elements: elementsJSON } = schemaDefinition;

  // We move forward to create the attribute groups and elements definitions
  const attributeGroups = createAttributeGroupsDefinitions(attributeGroupsJSON);
  const elements = createElementsDefinitions(elementsJSON);
  nodeResults.push(...attributeGroups, ...elements);

  const globalDeclaration = getGlobalDeclaration(elementsJSON);

  nodeResults.push(globalDeclaration);

  console.log(attributesInterfaceToSchemaNameMap);

  const resultFile = ts.createSourceFile(
    "someFileName.ts",
    "",
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ false,
    ts.ScriptKind.TS,
  );

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
  });

  resultFile.statements = ts.factory.createNodeArray(nodeResults);

  const dirtyFile = printer.printFile(resultFile);
  const sourceCodeWithDeclare = dirtyFile.replace("global", "declare global");
  const prettified = format(sourceCodeWithDeclare, {
    parser: "typescript",
    printWidth: 120,
    tabWidth: 2,
    trailingComma: "all",
  });

  fs.writeFileSync("result.d.ts", prettified);

  return nodeResults;
}
