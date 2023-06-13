import * as THREE from "three";

export type AttributeHandlerMap<T> = {
  [key: string]: (instance: T, newValue: string | null) => void;
};

export class AttributeHandler<T> {
  private map: AttributeHandlerMap<T>;

  constructor(map: AttributeHandlerMap<T>) {
    this.map = map;
  }

  public getAttributes() {
    return Object.keys(this.map);
  }

  public handle(instance: T, name: string, newValue: string): boolean {
    const handler = this.map[name];
    if (handler) {
      handler(instance, newValue);
      return true;
    }
    return false;
  }
}

export function parseColorAttribute(value: string | null, defaultValue: THREE.Color): THREE.Color {
  return parseAttribute(value, defaultValue, (value) => {
    return new THREE.Color(value as THREE.ColorRepresentation);
  });
}

export function parseAttribute<T>(
  value: string | null,
  defaultValue: T,
  parser: (value: string) => T | null,
): T {
  if (value === null) {
    return defaultValue;
  }
  const parsed = parser(value);
  if (parsed === null) {
    return defaultValue;
  }
  return parsed;
}

export function floatParser(value: string): number | null {
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    return null;
  }
  return parsed;
}

export function boolParser(value: string): boolean | null {
  if (value === "true") {
    return true;
  } else if (value === "false") {
    return false;
  }
  return null;
}

export function parseFloatAttribute(value: string | null, defaultValue: null): number | null;
export function parseFloatAttribute(value: string | null, defaultValue: number): number;

export function parseFloatAttribute(
  value: string | null,
  defaultValue: number | null,
): number | null {
  return parseAttribute(value, defaultValue, floatParser);
}

export function parseBoolAttribute(value: string | null, defaultValue: boolean): boolean {
  return parseAttribute(value, defaultValue, boolParser);
}

export function parseEnumAttribute<T extends string>(
  value: string | null,
  enumValues: Record<T, T>,
  defaultValue: T,
): T {
  return parseAttribute(value, defaultValue, (value) => {
    if (Object.keys(enumValues).indexOf(value as T) === -1) {
      return null;
    }
    return value as T;
  });
}
