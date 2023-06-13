import {
  XsAnnotation,
  XSD,
  XsElement,
  XsEnumeration,
  XsGroupAttribute,
  XsReference,
  XsRestriction,
  XsSchemaXsComplexType,
  XsSimpleType,
} from "./xsd";

export type AttributeGroup = {
  name: string;
  attributes: Array<Attribute>;
};

export type Attribute = {
  name: string;
  description?: Array<string>;
  type?: string;
  enum?: Array<string>;
};

export type Element = {
  name: string;
  description?: Array<string>;
  attributeGroups: Array<string>;
  attributes: Array<Attribute>;
};

function parseAnnotations(annotations: Array<XsAnnotation> | undefined): Array<string> {
  if (!annotations) {
    return [];
  }
  const descriptions: Array<string> = [];
  for (const xsAnnotation of annotations) {
    const documentationArray = xsAnnotation["xs:documentation"];
    for (const documentation of documentationArray) {
      const textArray = documentation._text;
      for (const text of textArray) {
        const documentationText: string = text.trim();
        if (documentationText) {
          descriptions.push(documentationText);
        }
      }
    }
  }
  return descriptions;
}

function xsAttributesToAttributes(xsAttributes: Array<XsGroupAttribute>): Array<Attribute> {
  const attributes: Array<Attribute> = [];
  for (const xsAttribute of xsAttributes) {
    const simpleTypeArray: XsSimpleType[] | undefined = xsAttribute["xs:simpleType"];
    const description = parseAnnotations(xsAttribute["xs:annotation"]);
    if (simpleTypeArray) {
      if (simpleTypeArray.length !== 1) {
        throw new Error("Expected simpleTypeArray to have length 1");
      }
      const simpleType: XsSimpleType = simpleTypeArray[0];
      const enumValues: Array<string> = [];
      const restrictionsArray = simpleType["xs:restriction"];
      if (restrictionsArray) {
        if (restrictionsArray.length !== 1) {
          throw new Error("Expected restrictionsArray to have length 1");
        }
        const restriction: XsRestriction = restrictionsArray[0];
        const enumerations: Array<XsEnumeration> = toArray(restriction["xs:enumeration"]);
        for (const enumeration of enumerations) {
          enumValues.push(enumeration._attributes.value);
        }
      }
      attributes.push({
        name: xsAttribute._attributes.name,
        enum: enumValues,
        description,
      });
    } else {
      attributes.push({
        name: xsAttribute._attributes.name,
        type: xsAttribute._attributes.type,
        description,
      });
    }
  }
  return attributes;
}

function toArray<T>(value: undefined | T | Array<T>): Array<T> {
  if (value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}

export type ComplexType = {
  name: string;
  elements: Array<string>;
};

export type SchemaDefinition = {
  elements: { [key: string]: Element };
  complexTypes: { [key: string]: ComplexType };
  attributeGroups: { [key: string]: AttributeGroup };
  simpleTypes: Array<string>;
};

export function createSchemaDefinition(schemaJSON: XSD): SchemaDefinition {
  const schemasArray = schemaJSON["xs:schema"];
  if (!schemasArray || schemasArray.length !== 1) {
    throw new Error("Expected schema to have one xs:schema element");
  }
  const schemaElement = schemasArray[0];
  const simpleTypes: Array<string> = schemaElement["xs:simpleType"].map((simpleType) => {
    return simpleType._attributes.name;
  });

  const elements: { [key: string]: Element } = {};
  schemaElement["xs:element"].forEach((element: XsElement) => {
    const description = parseAnnotations(element["xs:annotation"]);
    const attributeGroupRefs: Array<string> = [];
    const attributes: Array<Attribute> = [];
    const complexTypes = element["xs:complexType"];
    if (complexTypes) {
      if (complexTypes.length !== 1) {
        throw new Error("Complex types array has more than one element");
      }
      const complexType = complexTypes[0];
      const complexContentArray = complexType["xs:complexContent"];
      if (complexContentArray) {
        if (complexContentArray.length !== 1) {
          throw new Error("Complex content array has more than one element");
        }
        const complexContent = complexContentArray[0];
        const extensionsArray = complexContent["xs:extension"];
        if (extensionsArray) {
          if (extensionsArray.length !== 1) {
            throw new Error("Extensions array has more than one element");
          }
          const extension = extensionsArray[0];
          const attributeGroups = extension["xs:attributeGroup"];
          if (attributeGroups) {
            attributeGroups.forEach((attributeGroupRef) => {
              attributeGroupRefs.push(attributeGroupRef._attributes.ref);
            });
          }

          const xsAttributes = toArray(extension["xs:attribute"]);
          attributes.push(...xsAttributesToAttributes(xsAttributes));
        }
      }
      const complexAttributes = complexType["xs:attribute"];
      if (complexAttributes) {
        attributes.push(...xsAttributesToAttributes(toArray(complexAttributes)));
      }
    }
    const el: Element = {
      name: element._attributes.name,
      attributeGroups: attributeGroupRefs,
      attributes,
      description,
    };
    elements[el.name] = el;
  });

  const complexTypeVal = schemaElement["xs:complexType"];
  const complexTypes: { [key: string]: ComplexType } = {};
  (Array.isArray(complexTypeVal) ? complexTypeVal : [complexTypeVal]).forEach(
    (complexTypeVal: XsSchemaXsComplexType) => {
      const elements: Array<string> = [];
      const choiceArray = complexTypeVal["xs:choice"];
      if (!choiceArray || choiceArray.length !== 1) {
        throw new Error("Expected choice array to have length 1");
      }
      choiceArray[0]["xs:element"].forEach((element: XsReference) => {
        elements.push(element._attributes.ref);
      });
      const complexType: ComplexType = {
        name: complexTypeVal._attributes.name,
        elements,
      };
      complexTypes[complexType.name] = complexType;
    },
  );

  const attributeGroups: { [key: string]: AttributeGroup } = {};
  schemaElement["xs:attributeGroup"].forEach((attributeGroup) => {
    const name = attributeGroup._attributes.name;
    const xsAttributes = Array.isArray(attributeGroup["xs:attribute"])
      ? attributeGroup["xs:attribute"]
      : [attributeGroup["xs:attribute"]];

    const attributes = xsAttributesToAttributes(xsAttributes);
    attributeGroups[name] = { name, attributes };
  });

  return {
    elements,
    complexTypes,
    attributeGroups,
    simpleTypes,
  };
}
