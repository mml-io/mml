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

export function parseColorAttribute(value: string | null, defaultValue: null): THREE.Color | null;
export function parseColorAttribute(value: string | null, defaultValue: THREE.Color): THREE.Color;
export function parseColorAttribute(
  value: string | null,
  defaultValue: THREE.Color | null,
): THREE.Color | null {
  return parseAttribute(value, defaultValue, (value) => {
    // special case for hsl/hsla to change the behaviour at extremes such that animations can differentiate (and therefore lerp) between 0 and 360 degrees, and 0-1 lightness and saturation
    const m = /^(hsl|hsla)\(([^)]*)\)/.exec(value);
    if (m) {
      // rgb / hsl

      const components = m[2];
      const color =
        /^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)%\s*,\s*(\d*\.?\d+)%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(
          components,
        );
      if (color) {
        // hsl(120,50%,50%) hsla(120,50%,50%,0.5)
        let h = parseFloat(color[1]) / 360;
        if (h === 0) {
          h = 0.00001;
        } else if (h === 1) {
          h = 0.99999;
        }
        let s = parseFloat(color[2]) / 100;
        if (s === 0) {
          s = 0.00001;
        } else if (s === 1) {
          s = 0.99999;
        }
        let l = parseFloat(color[3]) / 100;
        if (l === 0) {
          l = 0.00001;
        } else if (l === 1) {
          l = 0.99999;
        }
        return new THREE.Color().setHSL(h, s, l, THREE.SRGBColorSpace);
      }
    }
    if (
      value in THREE.Color.NAMES ||
      (value.indexOf("#") === 0 && value.length === 7) ||
      (value.indexOf("#") === 0 && value.length === 4) ||
      (value.indexOf("hsl(") === 0 && value.indexOf(")") === value.length - 1) ||
      (value.indexOf("rgb(") === 0 && value.indexOf(")") === value.length - 1) ||
      (value.indexOf("rgba(") === 0 && value.indexOf(")") === value.length - 1)
    ) {
      return new THREE.Color(value);
    }
    return null;
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
