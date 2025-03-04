import { colors, hslToRGB, MMLColor } from "../color";

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

function parseRGB(value: string): MMLColor | null {
  const content = value.substring(value.indexOf("(") + 1, value.length - 1).split(",");
  if (content.length < 3 || content.length > 4) return null;

  const numbers = content.map((n) => parseFloat(n.trim()));
  if (numbers.some((n) => isNaN(n))) return null;

  return {
    r: Math.min(255, Math.max(0, numbers[0])) / 255,
    g: Math.min(255, Math.max(0, numbers[1])) / 255,
    b: Math.min(255, Math.max(0, numbers[2])) / 255,
    a: numbers.length === 4 ? Math.min(1, Math.max(0, numbers[3])) : undefined,
  };
}

function parseHSL(value: string): MMLColor | null {
  const content = value.substring(value.indexOf("(") + 1, value.length - 1).split(",");
  if (content.length < 3 || content.length > 4) return null;

  const numbers = content.map((n) => parseFloat(n.trim()));
  if (numbers.some((n) => isNaN(n))) return null;

  let [h, s, l] = numbers;

  h = h / 360;
  h = h === 0 ? 0.0001 : h === 1 ? 0.9999 : h;

  s = s / 100;
  s = s === 0 ? 0.0001 : s === 1 ? 0.9999 : s;

  l = l / 100;
  l = l === 0 ? 0.0001 : l === 1 ? 0.9999 : l;

  const rgb = hslToRGB(h, s, l);
  return {
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
    a: numbers.length === 4 ? Math.min(1, Math.max(0, numbers[3])) : undefined,
  };
}

export function parseColorAttribute(value: string | null, defaultValue: null): MMLColor | null;
export function parseColorAttribute(value: string | null, defaultValue: MMLColor): MMLColor;
export function parseColorAttribute(
  value: string | null,
  defaultValue: MMLColor | null,
): MMLColor | null {
  return parseAttribute(value, defaultValue, (value) => {
    const colorNameValues = colors[value];
    if (colorNameValues) {
      return {
        r: colorNameValues[0],
        g: colorNameValues[1],
        b: colorNameValues[2],
      };
    }

    if (value.length === 7) {
      const hex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(value);
      if (hex) {
        // e.g. #ff00ff
        return {
          r: parseInt(hex[1], 16) / 255,
          g: parseInt(hex[2], 16) / 255,
          b: parseInt(hex[3], 16) / 255,
        };
      }
    }

    if (value.length === 4) {
      const hex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(value);
      if (hex) {
        // e.g. #f0f
        return {
          r: parseInt(hex[1] + hex[1], 16) / 255,
          g: parseInt(hex[2] + hex[2], 16) / 255,
          b: parseInt(hex[3] + hex[3], 16) / 255,
        };
      }
    }

    if (value.indexOf("rgb(") === 0) {
      return parseRGB(value);
    }

    if (value.indexOf("rgba(") === 0) {
      return parseRGB(value);
    }

    if (value.indexOf("hsl(") === 0) {
      return parseHSL(value);
    }

    if (value.indexOf("hsla(") === 0) {
      return parseHSL(value);
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
