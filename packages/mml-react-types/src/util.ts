import { Attribute } from "@mml-io/mml-schema";

export function getReturnAttributeType(attribute: Attribute): string {
  if (attribute.enum) {
    return `${attribute.enum.map((e) => `"${e}"`).join(" | ")}`;
  }

  const attributeType = schemaToTSTypeMap[attribute.type as keyof typeof schemaToTSTypeMap];
  if (attributeType === "string") {
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
  StringOrFloat: "number",
} as const;

export function getAttributeGroupName(attributeGroupName: string) {
  return attributeGroupName.charAt(0).toUpperCase() + attributeGroupName.slice(1);
}

export function getAttributeGroupAttributesName(attributeGroupName: string) {
  return getAttributeGroupName(attributeGroupName) + "Attributes";
}
export function getMMLElementAttributesName(elementName: string) {
  return getMMLElementName(elementName) + "Attributes";
}

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
