import { format } from "prettier";
import ts from "typescript";
const { factory, NodeFlags, NewLineKind, createPrinter, SyntaxKind } = ts;

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
  Script: "",
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
      eventName?: string;
      eventClass?: string;
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
    const typeName = factory.createIdentifier(capitalizedTypeName);

    const attributesWithoutScripts = (attributeGroup.attributes || []).filter(
      (attribute) => attribute.type !== "Script",
    );

    const hasScriptAttributes =
      attributesWithoutScripts.length !== attributeGroup.attributes?.length;

    const members: any[] = (attributesWithoutScripts || []).map((attribute) => {
      const type = getReturnAttributeType(attribute);

      const typeNode = factory.createTypeReferenceNode(type, /*typeArguments*/ undefined);

      return factory.createPropertySignature(
        undefined,
        // can we create this with the factory methods?
        factory.createStringLiteral(attribute.name),
        factory.createToken(SyntaxKind.QuestionToken),
        typeNode,
      );
    });

    if (hasScriptAttributes) {
      const eventMapTypeName = factory.createIdentifier(`${capitalizedTypeName}EventMap`);

      const eventMapInterfaceDeclaration = factory.createInterfaceDeclaration(
        undefined,
        eventMapTypeName,
        undefined,
        undefined,
        (attributeGroup.attributes || [])
          .filter((attribute) => attribute.type === "Script")
          .map((attribute) => {
            const eventName = attribute.eventName as string;
            const eventClassNode = factory.createTypeReferenceNode(
              factory.createIdentifier(attribute.eventClass as string),
              undefined,
            );
            return factory.createPropertySignature(undefined, eventName, undefined, eventClassNode);
          }),
      );

      attributeGroups.push(eventMapInterfaceDeclaration);

      const addEventListenerMethod = factory.createMethodSignature(
        undefined,
        "addEventListener",
        undefined,
        undefined,
        [
          factory.createParameterDeclaration(
            undefined,
            undefined,
            "type",
            undefined,
            factory.createTypeReferenceNode("keyof " + eventMapTypeName.text, undefined),
          ),
          factory.createParameterDeclaration(
            undefined,
            undefined,
            "listener",
            undefined,
            factory.createTypeReferenceNode(
              factory.createIdentifier("EventListenerOrEventListenerObject"),
              undefined,
            ),
          ),
          factory.createParameterDeclaration(
            undefined,
            undefined,
            "options",
            factory.createToken(SyntaxKind.QuestionToken),
            factory.createUnionTypeNode([
              factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword),
              factory.createTypeReferenceNode("AddEventListenerOptions", undefined),
            ]),
          ),
        ],
        factory.createKeywordTypeNode(SyntaxKind.VoidKeyword),
      );
      // addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLImageElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;

      const addEventListenerMethodWithGenericType = factory.createMethodSignature(
        undefined,
        "addEventListener",
        undefined,
        [
          factory.createTypeParameterDeclaration(
            undefined,
            "K",
            factory.createTypeReferenceNode("keyof " + eventMapTypeName.text, undefined),
          ),
        ],
        [
          factory.createParameterDeclaration(
            undefined,
            undefined,
            "type",
            undefined,
            factory.createTypeReferenceNode("K", undefined),
          ),
          factory.createParameterDeclaration(
            undefined,
            undefined,
            "listener",
            undefined,
            factory.createFunctionTypeNode(
              undefined,
              [
                factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  "this",
                  undefined,
                  factory.createTypeReferenceNode("T", undefined),
                ),
                factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  "ev",
                  undefined,
                  factory.createIndexedAccessTypeNode(
                    factory.createTypeReferenceNode(eventMapTypeName, undefined),
                    factory.createTypeReferenceNode("K", undefined),
                  ),
                ),
              ],
              factory.createKeywordTypeNode(SyntaxKind.AnyKeyword),
            ),
          ),
          factory.createParameterDeclaration(
            undefined,
            undefined,
            "options",
            factory.createToken(SyntaxKind.QuestionToken),
            factory.createUnionTypeNode([
              factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword),
              factory.createTypeReferenceNode("AddEventListenerOptions", undefined),
            ]),
          ),
        ],
        factory.createKeywordTypeNode(SyntaxKind.VoidKeyword),
      );

      const removeEventListenerMethod = factory.createMethodSignature(
        undefined,
        "removeEventListener",
        undefined,
        undefined,
        [
          factory.createParameterDeclaration(
            undefined,
            undefined,
            "type",
            undefined,
            factory.createTypeReferenceNode("keyof " + eventMapTypeName.text, undefined),
          ),
          factory.createParameterDeclaration(
            undefined,
            undefined,
            "listener",
            undefined,
            factory.createTypeReferenceNode(
              factory.createIdentifier("EventListenerOrEventListenerObject"),
              undefined,
            ),
          ),
          factory.createParameterDeclaration(
            undefined,
            undefined,
            "options",
            factory.createToken(SyntaxKind.QuestionToken),
            factory.createUnionTypeNode([
              factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword),
              factory.createTypeReferenceNode("AddEventListenerOptions", undefined),
            ]),
          ),
        ],
        factory.createKeywordTypeNode(SyntaxKind.VoidKeyword),
      );

      const removeEventListenerMethodWithGenericType = factory.createMethodSignature(
        undefined,
        "removeEventListener",
        undefined,
        [
          factory.createTypeParameterDeclaration(
            undefined,
            "K",
            factory.createTypeReferenceNode("keyof " + eventMapTypeName.text, undefined),
          ),
        ],
        [
          factory.createParameterDeclaration(
            undefined,
            undefined,
            "type",
            undefined,
            factory.createTypeReferenceNode("K", undefined),
          ),
          factory.createParameterDeclaration(
            undefined,
            undefined,
            "listener",
            undefined,
            factory.createFunctionTypeNode(
              undefined,
              [
                factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  "this",
                  undefined,
                  factory.createTypeReferenceNode("T", undefined),
                ),
                factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  "ev",
                  undefined,
                  factory.createIndexedAccessTypeNode(
                    factory.createTypeReferenceNode(eventMapTypeName, undefined),
                    factory.createTypeReferenceNode("K", undefined),
                  ),
                ),
              ],
              factory.createKeywordTypeNode(SyntaxKind.AnyKeyword),
            ),
          ),
          factory.createParameterDeclaration(
            undefined,
            undefined,
            "options",
            factory.createToken(SyntaxKind.QuestionToken),
            factory.createUnionTypeNode([
              factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword),
              factory.createTypeReferenceNode("AddEventListenerOptions", undefined),
            ]),
          ),
        ],
        factory.createKeywordTypeNode(SyntaxKind.VoidKeyword),
      );

      const instanceDeclaration = factory.createInterfaceDeclaration(
        [factory.createToken(SyntaxKind.ExportKeyword)],
        typeName,
        [factory.createTypeParameterDeclaration(undefined, "T")],
        undefined,
        [
          addEventListenerMethodWithGenericType,
          addEventListenerMethod,
          removeEventListenerMethodWithGenericType,
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
      const attributeDeclaration = factory.createInterfaceDeclaration(
        [factory.createToken(SyntaxKind.ExportKeyword)],
        factory.createIdentifier(`${capitalizedTypeName}Attributes`),
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

    const members = attributes
      .filter((attribute) => attribute.type !== "Script")
      .map((attribute) => {
        const type = getReturnAttributeType(attribute);

        return factory.createPropertySignature(
          undefined,
          factory.createStringLiteral(attribute.name),
          factory.createToken(SyntaxKind.QuestionToken),
          factory.createTypeReferenceNode(type, undefined),
        );
      });

    // This is the only non-custom event we can support through react and pass as a prop
    if (element.attributeGroups.includes("clickable")) {
      members.push(
        factory.createPropertySignature(
          undefined,
          factory.createIdentifier("onClick"),
          factory.createToken(SyntaxKind.QuestionToken),
          factory.createFunctionTypeNode(
            undefined,
            [
              factory.createParameterDeclaration(
                undefined,
                undefined,
                "event",
                undefined,
                factory.createTypeReferenceNode("MMLClickEvent", undefined),
              ),
            ],
            factory.createKeywordTypeNode(SyntaxKind.VoidKeyword),
          ),
        ),
      );
    }

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
            const typeArguments = [factory.createTypeReferenceNode(name + "Element")];
            result.instanceHeritageClauses.push(
              factory.createTypeReferenceNode(attributeName, typeArguments),
            );
          }

          if (hasAttributes) {
            result.attributeHeritageClauses.push(
              factory.createTypeReferenceNode(attributeName + "Attributes"),
            );
          }
          return result;
        },
        { instanceHeritageClauses: [], attributeHeritageClauses: [] } as {
          instanceHeritageClauses: any[];
          attributeHeritageClauses: any[];
        },
      );

    const instanceDefaultHeritageClauses = [factory.createTypeReferenceNode("HTMLElement")];

    // create a type for each element
    const elementType = factory.createTypeAliasDeclaration(
      [factory.createToken(SyntaxKind.ExportKeyword)],
      factory.createIdentifier(name + "Element"),
      undefined,
      factory.createIntersectionTypeNode(
        instanceHeritageClauses.length
          ? [
              ...instanceDefaultHeritageClauses,
              factory.createIntersectionTypeNode(instanceHeritageClauses),
            ]
          : instanceDefaultHeritageClauses,
      ),
    );

    elementsDefinitions.push(elementType);

    const attributeDefaultHeritageClauses = [
      factory.createTypeReferenceNode("Coreattrs", [
        factory.createTypeReferenceNode(name + "Element"),
      ]),
    ];

    const attributeType = factory.createTypeAliasDeclaration(
      [factory.createToken(SyntaxKind.ExportKeyword)],
      factory.createIdentifier(name + "Attributes"),
      undefined,
      factory.createIntersectionTypeNode(
        members.length
          ? [
              factory.createTypeLiteralNode(members),
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

function createCoreAttributesType(schemaJSON: JSONSchema) {
  // We add a few types used by React for all elements then add the core attributes for MML
  return factory.createInterfaceDeclaration(
    undefined,
    factory.createIdentifier("Coreattrs"),
    // add generic T to the interface
    [factory.createTypeParameterDeclaration(undefined, "T")],
    undefined,
    [
      factory.createPropertySignature(
        undefined,
        factory.createIdentifier("key"),
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createTypeReferenceNode("string | number", undefined),
      ),
      factory.createPropertySignature(
        undefined,
        factory.createIdentifier("children"),
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createTypeReferenceNode("ReactNode | undefined", undefined),
      ),
      factory.createPropertySignature(
        undefined,
        factory.createIdentifier("ref"),
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createTypeReferenceNode("LegacyRef<T>", undefined),
      ),
      // MML Core attributes
      ...schemaJSON.attributeGroups.coreattrs.attributes!.map((attribute) => {
        const type = getReturnAttributeType(attribute);

        const typeNode = factory.createTypeReferenceNode(type, /*typeArguments*/ undefined);

        return factory.createPropertySignature(
          undefined,
          factory.createStringLiteral(attribute.name),
          factory.createToken(SyntaxKind.QuestionToken),
          typeNode,
        );
      }),
    ],
  );
}

function getGlobalDeclaration(elements: Elements) {
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
              .filter((element) => element.startsWith("m-"))
              .map((element) =>
                factory.createPropertySignature(
                  undefined,
                  factory.createComputedPropertyName(factory.createStringLiteral(element)),
                  undefined,
                  factory.createTypeReferenceNode(
                    elementsInterfaceToSchemaNameMap[element] + "Attributes",
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
