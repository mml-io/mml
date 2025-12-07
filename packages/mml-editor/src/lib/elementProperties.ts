export type PropertyInputType = "number" | "text" | "boolean" | "select" | "color";

export interface ElementPropertyDefinition {
  name: string;
  label: string;
  type: PropertyInputType;
  step?: number;
  min?: number;
  max?: number;
  options?: { label: string; value: string }[];
  placeholder?: string;
  defaultValue?: string;
}

const colorAttributeNames = new Set(["color", "font-color"]);

const transformProperties: ElementPropertyDefinition[] = [
  { name: "x", label: "Position X", type: "number", step: 0.1, defaultValue: "0" },
  { name: "y", label: "Position Y", type: "number", step: 0.1, defaultValue: "0" },
  { name: "z", label: "Position Z", type: "number", step: 0.1, defaultValue: "0" },
  { name: "rx", label: "Rotation X", type: "number", step: 1, defaultValue: "0" },
  { name: "ry", label: "Rotation Y", type: "number", step: 1, defaultValue: "0" },
  { name: "rz", label: "Rotation Z", type: "number", step: 1, defaultValue: "0" },
  { name: "sx", label: "Scale X", type: "number", step: 0.1, defaultValue: "1" },
  { name: "sy", label: "Scale Y", type: "number", step: 0.1, defaultValue: "1" },
  { name: "sz", label: "Scale Z", type: "number", step: 0.1, defaultValue: "1" },
  { name: "visible", label: "Visible", type: "boolean", defaultValue: "true" },
  { name: "socket", label: "Socket", type: "text", placeholder: "socket id", defaultValue: "" },
];

const tagExtras: Record<string, ElementPropertyDefinition[]> = {
  "m-light": [
    { name: "color", label: "Color", type: "color", defaultValue: "#ffffff" },
    { name: "intensity", label: "Intensity", type: "number", step: 1, defaultValue: "1" },
    { name: "angle", label: "Angle", type: "number", step: 1, defaultValue: "45" },
    { name: "distance", label: "Distance", type: "number", step: 1, defaultValue: "" },
    { name: "enabled", label: "Enabled", type: "boolean", defaultValue: "true" },
    { name: "cast-shadows", label: "Cast Shadows", type: "boolean", defaultValue: "true" },
    {
      name: "type",
      label: "Type",
      type: "select",
      options: [
        { value: "spotlight", label: "Spotlight" },
        { value: "point", label: "Point" },
      ],
      defaultValue: "spotlight",
    },
  ],
  "m-model": [
    { name: "src", label: "Model URL", type: "text", placeholder: "https://...", defaultValue: "" },
    { name: "anim", label: "Animation", type: "text", placeholder: "anim name", defaultValue: "" },
    { name: "anim-enabled", label: "Anim Enabled", type: "boolean", defaultValue: "true" },
    { name: "anim-loop", label: "Anim Loop", type: "boolean", defaultValue: "true" },
    { name: "cast-shadows", label: "Cast Shadows", type: "boolean", defaultValue: "true" },
    { name: "debug", label: "Debug", type: "boolean", defaultValue: "false" },
  ],
  "m-cube": [
    { name: "width", label: "Width", type: "number", step: 0.1, defaultValue: "1" },
    { name: "height", label: "Height", type: "number", step: 0.1, defaultValue: "1" },
    { name: "depth", label: "Depth", type: "number", step: 0.1, defaultValue: "1" },
    { name: "color", label: "Color", type: "color", defaultValue: "#ffffff" },
    { name: "opacity", label: "Opacity", type: "number", step: 0.05, defaultValue: "1" },
    { name: "cast-shadows", label: "Cast Shadows", type: "boolean", defaultValue: "true" },
    { name: "collide", label: "Collide", type: "boolean", defaultValue: "true" },
  ],
  "m-sphere": [
    { name: "radius", label: "Radius", type: "number", step: 0.05, defaultValue: "0.5" },
    { name: "color", label: "Color", type: "color", defaultValue: "#ffffff" },
    { name: "opacity", label: "Opacity", type: "number", step: 0.05, defaultValue: "1" },
    { name: "cast-shadows", label: "Cast Shadows", type: "boolean", defaultValue: "true" },
    { name: "collide", label: "Collide", type: "boolean", defaultValue: "true" },
  ],
  "m-image": [
    { name: "src", label: "Image URL", type: "text", placeholder: "https://...", defaultValue: "" },
    { name: "width", label: "Width", type: "number", step: 0.1, defaultValue: "" },
    { name: "height", label: "Height", type: "number", step: 0.1, defaultValue: "" },
    { name: "opacity", label: "Opacity", type: "number", step: 0.05, defaultValue: "1" },
    { name: "emissive", label: "Emissive", type: "number", step: 0.1, defaultValue: "0" },
    { name: "cast-shadows", label: "Cast Shadows", type: "boolean", defaultValue: "true" },
    { name: "collide", label: "Collide", type: "boolean", defaultValue: "true" },
  ],
  "m-video": [
    { name: "src", label: "Video URL", type: "text", placeholder: "https://...", defaultValue: "" },
    { name: "width", label: "Width", type: "number", step: 0.1, defaultValue: "" },
    { name: "height", label: "Height", type: "number", step: 0.1, defaultValue: "" },
    { name: "opacity", label: "Opacity", type: "number", step: 0.05, defaultValue: "1" },
    { name: "emissive", label: "Emissive", type: "number", step: 0.1, defaultValue: "0" },
    { name: "cast-shadows", label: "Cast Shadows", type: "boolean", defaultValue: "true" },
    { name: "collide", label: "Collide", type: "boolean", defaultValue: "true" },
  ],
  "m-attr-anim": [
    { name: "attr", label: "Target Attribute", type: "text", defaultValue: "" },
    { name: "start", label: "Start", type: "text", defaultValue: "0" },
    { name: "end", label: "End", type: "text", defaultValue: "0" },
    { name: "loop", label: "Loop", type: "boolean", defaultValue: "true" },
    { name: "ping-pong", label: "Ping Pong", type: "boolean", defaultValue: "false" },
    { name: "ping-pong-delay", label: "Ping Pong Delay", type: "number", step: 10, defaultValue: "0" },
    { name: "easing", label: "Easing", type: "text", defaultValue: "" },
    { name: "start-time", label: "Start Time", type: "number", step: 10, defaultValue: "0" },
    { name: "pause-time", label: "Pause Time", type: "number", step: 10, defaultValue: "" },
    { name: "duration", label: "Duration", type: "number", step: 10, defaultValue: "1000" },
  ],
  "m-attr-lerp": [
    { name: "attr", label: "Target Attribute", type: "text", defaultValue: "all" },
    { name: "easing", label: "Easing", type: "text", defaultValue: "" },
    { name: "duration", label: "Duration", type: "number", step: 10, defaultValue: "1000" },
  ],
};

function toLabel(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferType(name: string, value: string | null): PropertyInputType {
  if (colorAttributeNames.has(name)) {
    return "color";
  }
  if (value === "true" || value === "false") {
    return "boolean";
  }
  const numeric = Number(value);
  if (value !== null && !Number.isNaN(numeric) && value.trim() !== "") {
    return "number";
  }
  return "text";
}

function dedupe(defs: ElementPropertyDefinition[]): ElementPropertyDefinition[] {
  const seen = new Map<string, ElementPropertyDefinition>();
  for (const def of defs) {
    if (!seen.has(def.name)) {
      seen.set(def.name, def);
    }
  }
  return Array.from(seen.values());
}

export function getElementPropertyDefinitions(element: HTMLElement): ElementPropertyDefinition[] {
  const tag = element.tagName.toLowerCase();
  const defs: ElementPropertyDefinition[] = [];

  if ((element as any).isTransformableElement) {
    defs.push(...transformProperties);
  }

  if (tagExtras[tag]) {
    defs.push(...tagExtras[tag]);
  }

  const attributeDefs = Array.from(element.attributes).map<ElementPropertyDefinition>((attr) => ({
    name: attr.name,
    label: toLabel(attr.name),
    type: inferType(attr.name, attr.value),
  }));

  return dedupe([...defs, ...attributeDefs]);
}

export function getSharedElementPropertyDefinitions(elements: HTMLElement[]): ElementPropertyDefinition[] {
  if (elements.length === 0) {
    return [];
  }

  const perElement = elements.map((element) => getElementPropertyDefinitions(element));

  return perElement.reduce<ElementPropertyDefinition[]>((shared, defs) => {
    const names = new Set(defs.map((d) => d.name));
    return shared.filter((def) => names.has(def.name));
  }, perElement[0]);
}

export function getDefaultValueForProperty(def: ElementPropertyDefinition): string {
  return def.defaultValue ?? "";
}

