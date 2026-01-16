/**
 * Schema type definitions for MML elements.
 * These types are used to generate XSD, markdown docs, and JSON schema from code.
 */

/**
 * Attribute type identifiers
 */
export type AttributeType =
  | "number"
  | "boolean"
  | "string"
  | "color"
  | "uri"
  | "script"
  | "id"
  | "enum";

/**
 * Attribute schema definition
 */
export interface AttributeSchema {
  /** The attribute type */
  type: AttributeType;
  /** Default value as a string */
  default?: string;
  /** Description of the attribute */
  description: string;
  /** For enum types, the possible values */
  enumValues?: string[];
  /** Whether this attribute is animatable */
  animatable?: boolean;
  /** For script attributes, the event name and class */
  event?: {
    name: string;
    eventClass: string;
  };
}

/**
 * Attribute group schema (e.g., transformable, clickable)
 */
export interface AttributeGroupSchema {
  /** Group name */
  name: string;
  /** Group description */
  description: string;
  /** Attributes in this group */
  attributes: Record<string, AttributeSchema>;
}

/**
 * Element schema definition
 */
export interface ElementSchema {
  /** Element tag name (e.g., "m-cube") */
  tagName: string;
  /** Element description */
  description: string;
  /** Attribute groups this element uses */
  attributeGroups: string[];
  /** Element-specific attributes */
  attributes: Record<string, AttributeSchema>;
  /** Example code snippets */
  examples?: ExampleSchema[];
}

/**
 * Example code snippet
 */
export interface ExampleSchema {
  /** Example title */
  title: string;
  /** Description of what the example demonstrates */
  description?: string;
  /** The example code */
  code: string;
}

/**
 * Complete schema registry
 */
export interface SchemaRegistry {
  elements: Record<string, ElementSchema>;
  attributeGroups: Record<string, AttributeGroupSchema>;
}

/**
 * Built-in attribute groups
 */
export const coreAttrsGroup: AttributeGroupSchema = {
  name: "coreattrs",
  description: "Attributes common to all elements.",
  attributes: {
    id: {
      type: "id",
      description:
        "A unique identifier for the element, used for selection and manipulation through scripting. It must be unique within the document.",
    },
    class: {
      type: "string",
      description: "A space-separated list of class names that can be used for scripting purposes.",
    },
  },
};

export const transformableGroup: AttributeGroupSchema = {
  name: "transformable",
  description: "Attributes for positioning, rotating and scaling in 3D.",
  attributes: {
    x: {
      type: "number",
      default: "0",
      description: "The position of the element along the X-axis in meters.",
      animatable: true,
    },
    y: {
      type: "number",
      default: "0",
      description: "The position of the element along the Y-axis in meters.",
      animatable: true,
    },
    z: {
      type: "number",
      default: "0",
      description: "The position of the element along the Z-axis in meters.",
      animatable: true,
    },
    rx: {
      type: "number",
      default: "0",
      description: "The rotation of the element around the X-axis in degrees.",
      animatable: true,
    },
    ry: {
      type: "number",
      default: "0",
      description: "The rotation of the element around the Y-axis in degrees.",
      animatable: true,
    },
    rz: {
      type: "number",
      default: "0",
      description: "The rotation of the element around the Z-axis in degrees.",
      animatable: true,
    },
    sx: {
      type: "number",
      default: "1",
      description: "The scale of the element along the X-axis.",
      animatable: true,
    },
    sy: {
      type: "number",
      default: "1",
      description: "The scale of the element along the Y-axis.",
      animatable: true,
    },
    sz: {
      type: "number",
      default: "1",
      description: "The scale of the element along the Z-axis.",
      animatable: true,
    },
  },
};

export const clickableGroup: AttributeGroupSchema = {
  name: "clickable",
  description:
    "This attribute group indicates that this element is clickable. The onclick attribute is a script expression that is executed when the element is clicked.",
  attributes: {
    clickable: {
      type: "boolean",
      default: "true",
      description:
        "Whether the element is clickable (true) or not (false). If false, any click will pass through as if the element was not present.",
    },
    onclick: {
      type: "script",
      description:
        'A script expression that is executed when the element is clicked. Events are also dispatched to "click" event listeners.',
      event: {
        name: "click",
        eventClass: "MMLClickEvent",
      },
    },
  },
};

export const collideableGroup: AttributeGroupSchema = {
  name: "collideable",
  description: "Attributes for physics collision detection.",
  attributes: {
    collide: {
      type: "boolean",
      default: "true",
      description: "Whether this element should participate in collision detection.",
    },
    "collision-interval": {
      type: "number",
      default: "100",
      description: "The minimum interval in milliseconds between collision events.",
    },
  },
};

export const colorableGroup: AttributeGroupSchema = {
  name: "colorable",
  description: "Attributes for element color and transparency.",
  attributes: {
    color: {
      type: "color",
      default: "white",
      description:
        "The color of the element. Supports CSS color values including named colors, hex (#ff0000), rgb(), rgba(), hsl(), hsla().",
      animatable: true,
    },
    opacity: {
      type: "number",
      default: "1",
      description: "The opacity of the element, from 0 (fully transparent) to 1 (fully opaque).",
      animatable: true,
    },
  },
};

export const shadowsGroup: AttributeGroupSchema = {
  name: "shadows",
  description: "Attributes for shadow casting.",
  attributes: {
    "cast-shadows": {
      type: "boolean",
      default: "true",
      description: "Whether this element casts shadows.",
    },
  },
};

/**
 * All built-in attribute groups
 */
export const builtinAttributeGroups: Record<string, AttributeGroupSchema> = {
  coreattrs: coreAttrsGroup,
  transformable: transformableGroup,
  clickable: clickableGroup,
  collideable: collideableGroup,
  colorable: colorableGroup,
  shadows: shadowsGroup,
};
