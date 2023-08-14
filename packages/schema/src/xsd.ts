export type XSD = {
  _declaration: {
    _attributes: {
      version: string;
    };
  };
  _instruction: {
    "xml-stylesheet": string;
  };
  "xs:schema": Array<{
    _attributes: {
      elementFormDefault: string;
      "xmlns:xs": string;
    };
    "xs:annotation": Array<XsAnnotation>;
    "xs:simpleType": Array<{
      _attributes: XsBasicElementAttributes;
      "xs:annotation": Array<XsAnnotation>;
      "xs:restriction": Array<{
        _attributes: XsRestrictionAttributes;
      }>;
    }>;
    "xs:attributeGroup": Array<{
      _attributes: XsBasicElementAttributes;
      "xs:annotation": Array<XsAnnotation>;
      "xs:attribute": Array<XsGroupAttribute>;
    }>;
    "xs:element": Array<XsElement>;
    "xs:group": {
      _attributes: XsBasicElementAttributes;
      "xs:sequence": Array<{
        "xs:choice": Array<XsChoice>;
      }>;
    };
    "xs:complexType": Array<XsSchemaXsComplexType>;
  }>;
};

export type XsAnnotation = {
  "xs:documentation": Array<{
    _text: Array<string>;
  }>;
  "xs:appinfo"?: Array<{
    _text: Array<string>;
  }>;
};

export type XsBasicElementAttributes = {
  name: string;
};

export type XsGroupAttribute = {
  _attributes: {
    name: string;
    type?: string;
  };
  "xs:annotation"?: Array<XsAnnotation>;
  "xs:simpleType"?: Array<XsSimpleType>;
};

export type XsSchemaXsComplexType = {
  _attributes: {
    name: string;
    mixed: "true";
  };
  "xs:annotation": Array<XsAnnotation>;
  "xs:choice": Array<XsChoice>;
};

export type XsChoice = {
  _attributes: XsChoiceAttributes;
  "xs:element": Array<XsReference>;
};

export type XsChoiceAttributes = {
  minOccurs: string;
  maxOccurs: string;
};

export type XsReference = {
  _attributes: {
    ref: string;
  };
};

export type XsElement = {
  _attributes: XsBasicElementAttributes;
  "xs:annotation"?: Array<XsAnnotation>;
  "xs:complexType": Array<{
    _attributes?: {
      mixed: string;
    };
    "xs:sequence"?: Array<{
      "xs:element"?: Array<XsReference>;
      "xs:group"?: Array<XsReference>;
      "xs:choice"?: Array<{
        "xs:sequence": Array<{
          "xs:group": Array<XsReference>;
          "xs:sequence"?: Array<{
            _attributes: {
              minOccurs: string;
            };
            "xs:group": Array<XsReference>;
          }>;
        }>;
        "xs:element": Array<XsElement>;
      }>;
    }>;
    "xs:attribute"?: Array<XsGroupAttribute>;
    "xs:complexContent"?: Array<{
      "xs:extension": Array<{
        _attributes: XsRestrictionAttributes;
        "xs:attributeGroup": Array<XsReference>;
        "xs:attribute"?: Array<XsGroupAttribute>;
      }>;
    }>;
  }>;
};

export type XsSimpleType = {
  "xs:restriction": Array<XsRestriction>;
};

export type XsRestriction = {
  _attributes: XsRestrictionAttributes;
  "xs:enumeration": Array<XsEnumeration>;
};

export type XsRestrictionAttributes = {
  base: string;
};

export type XsEnumeration = {
  _attributes: {
    value: string;
  };
};
