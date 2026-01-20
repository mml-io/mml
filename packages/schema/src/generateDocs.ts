/**
 * Documentation generator for MML schema.
 * Generates markdown documentation and XSD from the element schemas.
 */

import { elementSchemas, schemaRegistry } from "./elements";
import { AttributeGroupSchema, AttributeSchema, ElementSchema } from "./elementSchema";

// ============================================================================
// Markdown Generation
// ============================================================================

/**
 * Generate markdown documentation for a single element
 */
export function generateElementMarkdown(schema: ElementSchema): string {
  const lines: string[] = [];

  lines.push(`# ${schema.tagName}`);
  lines.push("");
  lines.push(schema.description);
  lines.push("");

  // Element-specific attributes
  const attrs = Object.entries(schema.attributes);
  if (attrs.length > 0) {
    lines.push("## Attributes");
    lines.push("");
    lines.push("| Attribute | Type | Default | Description |");
    lines.push("|-----------|------|---------|-------------|");

    for (const [name, attr] of attrs) {
      const typeStr = attr.type === "enum" ? attr.enumValues?.join(" \\| ") || "enum" : attr.type;
      const defaultStr = attr.default || "-";
      const animStr = attr.animatable ? " (animatable)" : "";
      lines.push(`| ${name} | ${typeStr} | ${defaultStr} | ${attr.description}${animStr} |`);
    }
    lines.push("");
  }

  // Attribute groups
  if (schema.attributeGroups.length > 0) {
    lines.push("## Inherited Attribute Groups");
    lines.push("");
    for (const groupName of schema.attributeGroups) {
      const group = schemaRegistry.attributeGroups[groupName];
      if (group) {
        const attrNames = Object.keys(group.attributes).join(", ");
        lines.push(`- **${groupName}**: ${attrNames}`);
      }
    }
    lines.push("");
  }

  // Examples
  if (schema.examples && schema.examples.length > 0) {
    lines.push("## Examples");
    lines.push("");
    for (const example of schema.examples) {
      lines.push(`### ${example.title}`);
      if (example.description) {
        lines.push("");
        lines.push(example.description);
      }
      lines.push("");
      lines.push("```xml");
      lines.push(example.code);
      lines.push("```");
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Generate markdown documentation for an attribute group
 */
export function generateAttributeGroupMarkdown(group: AttributeGroupSchema): string {
  const lines: string[] = [];

  lines.push(`# ${group.name}`);
  lines.push("");
  lines.push(group.description);
  lines.push("");
  lines.push("## Attributes");
  lines.push("");
  lines.push("| Attribute | Type | Default | Description |");
  lines.push("|-----------|------|---------|-------------|");

  for (const [name, attr] of Object.entries(group.attributes)) {
    const typeStr = attr.type === "enum" ? attr.enumValues?.join(" \\| ") || "enum" : attr.type;
    const defaultStr = attr.default || "-";
    const animStr = attr.animatable ? " (animatable)" : "";
    lines.push(`| ${name} | ${typeStr} | ${defaultStr} | ${attr.description}${animStr} |`);
  }

  return lines.join("\n");
}

/**
 * Generate a combined markdown document with all elements
 */
export function generateAllElementsMarkdown(): string {
  const lines: string[] = [];

  lines.push("# MML Element Reference");
  lines.push("");
  lines.push("Complete reference for all MML elements and their attributes.");
  lines.push("");

  // Table of contents
  lines.push("## Elements");
  lines.push("");
  const categories: Record<string, string[]> = {
    Geometry: ["m-cube", "m-sphere", "m-cylinder", "m-capsule", "m-plane"],
    Composite: ["m-group", "m-model", "m-character", "m-frame"],
    Media: ["m-audio", "m-image", "m-video", "m-label"],
    Lighting: ["m-light"],
    Interaction: ["m-interaction", "m-position-probe", "m-chat-probe", "m-prompt", "m-link"],
    Animation: ["m-attr-anim", "m-attr-lerp"],
    UI: ["m-overlay"],
  };

  for (const [category, elements] of Object.entries(categories)) {
    lines.push(`### ${category}`);
    lines.push("");
    for (const tagName of elements) {
      const schema = elementSchemas[tagName];
      if (schema) {
        lines.push(`- **${tagName}**: ${schema.description}`);
      }
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  // Full documentation for each element
  for (const schema of Object.values(elementSchemas)) {
    lines.push(generateElementMarkdown(schema));
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate attribute groups reference section
 */
function generateAttributeGroupsReference(): string[] {
  const lines: string[] = [];

  lines.push("# Attribute Groups");
  lines.push("");
  lines.push("These attribute groups are inherited by elements. When an element lists a group,");
  lines.push("it supports all attributes in that group.");
  lines.push("");

  for (const group of Object.values(schemaRegistry.attributeGroups)) {
    lines.push(`## ${group.name}`);
    lines.push(group.description);
    lines.push("");

    for (const [name, attr] of Object.entries(group.attributes)) {
      const typeStr = attr.type === "enum" ? attr.enumValues?.join("|") || "enum" : attr.type;
      const defaultStr = attr.default ? ` (default: ${attr.default})` : "";
      lines.push(`  ${name.padEnd(20)} ${typeStr.padEnd(10)}${defaultStr}`);
      lines.push(`    ${attr.description}`);
    }
    lines.push("");
  }

  return lines;
}

/**
 * Generate brief documentation suitable for stdout
 */
export function generateBriefDocs(elementName?: string): string {
  const lines: string[] = [];

  if (elementName) {
    const schema = elementSchemas[elementName];
    if (!schema) {
      return `Unknown element: ${elementName}`;
    }

    lines.push(`## ${schema.tagName}`);
    lines.push("");
    lines.push(schema.description);
    lines.push("");

    // Inherited groups first (just names)
    if (schema.attributeGroups.length > 0) {
      lines.push(`Inherits: ${schema.attributeGroups.join(", ")}`);
      lines.push("");
    }

    // Element-specific attributes
    if (Object.keys(schema.attributes).length > 0) {
      lines.push("Element-specific attributes:");
      for (const [name, attr] of Object.entries(schema.attributes)) {
        const typeStr = attr.type === "enum" ? attr.enumValues?.join("|") || "enum" : attr.type;
        const defaultStr = attr.default ? ` (default: ${attr.default})` : "";
        lines.push(`  ${name.padEnd(20)} ${typeStr.padEnd(10)}${defaultStr}`);
        lines.push(`    ${attr.description}`);
      }
      lines.push("");
    }

    // Examples
    if (schema.examples && schema.examples.length > 0) {
      lines.push("Examples:");
      for (const example of schema.examples) {
        lines.push(`  ${example.title}:`);
        lines.push(`    ${example.code}`);
      }
      lines.push("");
    }

    // Show inherited attribute groups reference
    lines.push("---");
    lines.push("");
    lines.push(...generateAttributeGroupsReference());
  } else {
    // Show attribute groups reference first
    lines.push(...generateAttributeGroupsReference());
    lines.push("---");
    lines.push("");
    lines.push("# Elements");
    lines.push("");

    // List all elements briefly
    for (const schema of Object.values(elementSchemas)) {
      lines.push(`## ${schema.tagName}`);
      lines.push(schema.description);

      // Inherited groups (just names)
      if (schema.attributeGroups.length > 0) {
        lines.push(`Inherits: ${schema.attributeGroups.join(", ")}`);
      }

      // Element-specific attributes
      if (Object.keys(schema.attributes).length > 0) {
        lines.push("Attributes:");
        for (const [name, attr] of Object.entries(schema.attributes)) {
          const typeStr = attr.type === "enum" ? attr.enumValues?.join("|") || "enum" : attr.type;
          const defaultStr = attr.default || "-";
          lines.push(
            `  ${name.padEnd(20)} ${typeStr.padEnd(10)} ${defaultStr.padEnd(10)} ${attr.description}`,
          );
        }
      }

      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Generate JSON output for an element or all elements
 */
export function generateJSON(elementName?: string): string {
  if (elementName) {
    const schema = elementSchemas[elementName];
    if (!schema) {
      return JSON.stringify({ error: `Unknown element: ${elementName}` });
    }
    return JSON.stringify(schema, null, 2);
  }
  return JSON.stringify(schemaRegistry, null, 2);
}

// ============================================================================
// Examples Generation
// ============================================================================

/**
 * Generate examples documentation
 */
export function generateExamples(elementName?: string, _category?: string): string {
  const lines: string[] = [];

  const elementsToShow = elementName
    ? [elementSchemas[elementName]].filter(Boolean)
    : Object.values(elementSchemas);

  for (const schema of elementsToShow) {
    if (!schema.examples || schema.examples.length === 0) continue;

    lines.push(`## ${schema.tagName} Examples`);
    lines.push("");

    for (const example of schema.examples) {
      lines.push(`### ${example.title}`);
      if (example.description) {
        lines.push(example.description);
      }
      lines.push("```xml");
      lines.push(example.code);
      lines.push("```");
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  if (lines.length === 0) {
    return elementName ? `No examples found for ${elementName}` : "No examples found";
  }

  return lines.join("\n");
}

// ============================================================================
// XSD Generation
// ============================================================================

/**
 * Convert attribute type to XSD type
 */
function toXsdType(type: string): string {
  switch (type) {
    case "number":
      return "xs:float";
    case "boolean":
      return "xs:boolean";
    case "string":
      return "xs:string";
    case "color":
      return "xs:string";
    case "uri":
      return "URI";
    case "script":
      return "Script";
    case "id":
      return "xs:ID";
    case "enum":
      return "xs:string"; // Will be overridden with restriction
    default:
      return "xs:string";
  }
}

/**
 * Generate XSD for an attribute
 */
function generateAttributeXsd(name: string, attr: AttributeSchema, indent: string): string {
  const lines: string[] = [];

  if (attr.type === "enum" && attr.enumValues) {
    // Enum attribute with restriction
    lines.push(`${indent}<xs:attribute name="${name}">`);
    lines.push(`${indent}  <xs:annotation>`);
    lines.push(`${indent}    <xs:documentation>${escapeXml(attr.description)}</xs:documentation>`);
    lines.push(`${indent}  </xs:annotation>`);
    lines.push(`${indent}  <xs:simpleType>`);
    lines.push(`${indent}    <xs:restriction base="xs:string">`);
    for (const value of attr.enumValues) {
      lines.push(`${indent}      <xs:enumeration value="${value}"/>`);
    }
    lines.push(`${indent}    </xs:restriction>`);
    lines.push(`${indent}  </xs:simpleType>`);
    lines.push(`${indent}</xs:attribute>`);
  } else {
    // Regular attribute
    const defaultAttr = attr.default ? ` default="${attr.default}"` : "";
    lines.push(
      `${indent}<xs:attribute name="${name}" type="${toXsdType(attr.type)}"${defaultAttr}>`,
    );
    lines.push(`${indent}  <xs:annotation>`);
    if (attr.event) {
      lines.push(
        `${indent}    <xs:appinfo>${attr.event.name}|${attr.event.eventClass}</xs:appinfo>`,
      );
    }
    lines.push(`${indent}    <xs:documentation>${escapeXml(attr.description)}</xs:documentation>`);
    lines.push(`${indent}  </xs:annotation>`);
    lines.push(`${indent}</xs:attribute>`);
  }

  return lines.join("\n");
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate XSD for an attribute group
 */
function generateAttributeGroupXsd(group: AttributeGroupSchema): string {
  const lines: string[] = [];

  lines.push(`  <xs:attributeGroup name="${group.name}">`);
  lines.push(`    <xs:annotation>`);
  lines.push(`      <xs:documentation>${escapeXml(group.description)}</xs:documentation>`);
  lines.push(`    </xs:annotation>`);

  for (const [name, attr] of Object.entries(group.attributes)) {
    lines.push(generateAttributeXsd(name, attr, "    "));
  }

  lines.push(`  </xs:attributeGroup>`);

  return lines.join("\n");
}

/**
 * Generate XSD for an element
 */
function generateElementXsd(schema: ElementSchema): string {
  const lines: string[] = [];

  lines.push(`  <xs:element name="${schema.tagName}">`);
  lines.push(`    <xs:annotation>`);
  lines.push(`      <xs:documentation>${escapeXml(schema.description)}</xs:documentation>`);
  lines.push(`    </xs:annotation>`);
  lines.push(`    <xs:complexType>`);
  lines.push(`      <xs:complexContent>`);
  lines.push(`        <xs:extension base="MMLElementContent">`);

  // Attribute group references
  for (const groupName of schema.attributeGroups) {
    lines.push(`          <xs:attributeGroup ref="${groupName}"/>`);
  }

  // Element-specific attributes
  for (const [name, attr] of Object.entries(schema.attributes)) {
    lines.push(generateAttributeXsd(name, attr, "          "));
  }

  lines.push(`        </xs:extension>`);
  lines.push(`      </xs:complexContent>`);
  lines.push(`    </xs:complexType>`);
  lines.push(`  </xs:element>`);

  return lines.join("\n");
}

/**
 * Generate complete XSD schema
 */
export function generateXsd(): string {
  const lines: string[] = [];

  lines.push(`<?xml version='1.0'?>`);
  lines.push(
    `<xs:schema elementFormDefault="qualified" xmlns:xs="http://www.w3.org/2001/XMLSchema">`,
  );
  lines.push(`  <xs:annotation>`);
  lines.push(`    <xs:documentation>`);
  lines.push(`      MML Schema Definition`);
  lines.push(`      Generated from code - do not edit manually.`);
  lines.push(`    </xs:documentation>`);
  lines.push(`  </xs:annotation>`);
  lines.push("");

  // Simple types
  lines.push(`  <xs:simpleType name="URI">`);
  lines.push(`    <xs:restriction base="xs:anyURI"/>`);
  lines.push(`  </xs:simpleType>`);
  lines.push("");
  lines.push(`  <xs:simpleType name="Script">`);
  lines.push(`    <xs:restriction base="xs:string"/>`);
  lines.push(`  </xs:simpleType>`);
  lines.push("");

  // Base complex type for element content
  lines.push(`  <xs:complexType name="MMLElementContent" mixed="true">`);
  lines.push(`    <xs:choice minOccurs="0" maxOccurs="unbounded">`);
  for (const tagName of Object.keys(elementSchemas)) {
    lines.push(`      <xs:element ref="${tagName}"/>`);
  }
  lines.push(`    </xs:choice>`);
  lines.push(`  </xs:complexType>`);
  lines.push("");

  // Attribute groups
  for (const group of Object.values(schemaRegistry.attributeGroups)) {
    lines.push(generateAttributeGroupXsd(group));
    lines.push("");
  }

  // Elements
  for (const schema of Object.values(elementSchemas)) {
    lines.push(generateElementXsd(schema));
    lines.push("");
  }

  lines.push(`</xs:schema>`);

  return lines.join("\n");
}

// ============================================================================
// Export
// ============================================================================

export { elementSchemas, schemaRegistry };
