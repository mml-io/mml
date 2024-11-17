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
      const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(value);
      if (rgb) {
        // e.g. rgb(255,0,255)
        return {
          r: parseInt(rgb[1], 10) / 255,
          g: parseInt(rgb[2], 10) / 255,
          b: parseInt(rgb[3], 10) / 255,
        };
      }
    }

    if (value.indexOf("rgba(") === 0) {
      const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*(\d*\.?\d+)\)$/.exec(value);
      if (rgba) {
        // e.g. rgba(255,0,255,0.5)
        return {
          r: parseInt(rgba[1], 10) / 255,
          g: parseInt(rgba[2], 10) / 255,
          b: parseInt(rgba[3], 10) / 255,
          a: parseFloat(rgba[4]),
        };
      }
    }

    if (value.indexOf("hsl(") === 0) {
      const hsl = /^hsl\(\s*(\d+)\s*,\s*(\d+(?:\.\d+)?%)\s*,\s*(\d+(?:\.\d+)?%)\)$/.exec(value);
      if (hsl) {
        let h = parseFloat(hsl[1]) / 360;
        // special case for hsl/hsla to change the behaviour at extremes such that animations can differentiate (and therefore lerp) between 0 and 360 degrees
        if (h === 0) {
          h = 0.0001;
        } else if (h === 1) {
          h = 0.9999;
        }
        let s = parseFloat(hsl[2]) / 100;
        if (s === 0) {
          s = 0.0001;
        } else if (s === 1) {
          s = 0.9999;
        }
        let l = parseFloat(hsl[3]) / 100;
        if (l === 0) {
          l = 0.0001;
        } else if (l === 1) {
          l = 0.9999;
        }
        return hslToRGB(h, s, l);
      }
    }

    if (value.indexOf("hsla(") === 0) {
      const hsla =
        /^hsla\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?%)\s*,\s*(\d+(?:\.\d+)?%),\s*(\d+(?:\.\d+)?)\)$/.exec(
          value,
        );
      if (hsla) {
        let h = parseFloat(hsla[1]) / 360;
        // special case for hsl/hsla to change the behaviour at extremes such that animations can differentiate (and therefore lerp) between 0 and 360 degrees
        if (h === 0) {
          h = 0.0001;
        } else if (h === 1) {
          h = 0.9999;
        }
        let s = parseFloat(hsla[2]) / 100;
        if (s === 0) {
          s = 0.0001;
        } else if (s === 1) {
          s = 0.9999;
        }
        let l = parseFloat(hsla[3]) / 100;
        if (l === 0) {
          l = 0.0001;
        } else if (l === 1) {
          l = 0.9999;
        }
        return hslToRGB(h, s, l);
      }
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
