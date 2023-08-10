import ts from "typescript";

const { factory, NodeFlags, NewLineKind, createPrinter, SyntaxKind } = ts;

export function getReturnAttributeType(attribute: Attributes) {
  if (attribute.enum) {
    return `${attribute.enum.map((e) => `"${e}"`).join(" | ")}`;
  }

  const attributeType = schemaToTSTypeMap[attribute.type as keyof typeof schemaToTSTypeMap];
  if (["() => void", "string"].includes(attributeType)) {
    return attributeType;
  }

  return attributeType + " | string";
}

export function getAttributeGroupName(attributeGroupName: string) {
  return attributeGroupName.charAt(0).toUpperCase() + attributeGroupName.slice(1);
}

export function getAttributeGroupAttributesName(attributeGroupName: string) {
  return getAttributeGroupName(attributeGroupName) + "Attributes";
}
export function getMMLElementAttributesName(elementName: string) {
  return getMMLElementName(elementName) + "Attributes";
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

export type Attributes = {
  name: string;
  type: keyof typeof schemaToTSTypeMap;
  eventName?: string;
  eventClass?: string;
  enum?: string[];
};

export type AttributeGroup = {
  attributes?: Attributes[];
};

export type AttributeGroups = {
  [attributeGroupName: string]: AttributeGroup;
};

export type Element = {
  name: string;
  attributes: Attributes[];
  attributeGroups: string[];
  description: string[];
};

export type Elements = {
  [elementName: string]: Element;
};

export type JSONSchema = {
  elements: Elements;
  attributeGroups: AttributeGroups;
};

export function getMMLElementName(elementName: string) {
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

export function createEventMapInterfaceDeclaration(
  eventMapTypeName: ts.Identifier,
  attributes: Attributes[],
) {
  return factory.createInterfaceDeclaration(
    undefined,
    eventMapTypeName,
    undefined,
    undefined,
    (attributes || [])
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
}

export function createEventHandlersDeclarations(eventMapTypeName: ts.Identifier) {
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

  return [
    addEventListenerMethodWithGenericType,
    addEventListenerMethod,
    removeEventListenerMethodWithGenericType,
    removeEventListenerMethod,
  ];
}
