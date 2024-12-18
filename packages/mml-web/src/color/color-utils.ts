import { MMLColor } from "./MMLColor";

export function lerpHSL(colorA: MMLColor, colorB: MMLColor, alpha: number): MMLColor {
  const hslA = getHSL(colorA);
  const hslB = getHSL(colorB);
  const h = hslA.h + (hslB.h - hslA.h) * alpha;
  const s = hslA.s + (hslB.s - hslA.s) * alpha;
  const l = hslA.l + (hslB.l - hslA.l) * alpha;
  return hslToRGB(h, s, l);
}

function hue2RGB(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * 6 * (2 / 3 - t);
  return p;
}

function euclideanModulo(n: number, m: number) {
  return ((n % m) + m) % m;
}

export function hslToRGB(h: number, s: number, l: number): MMLColor {
  h = euclideanModulo(h, 1);
  s = Math.max(0, Math.min(s, 1));
  l = Math.max(0, Math.min(l, 1));

  if (s === 0) {
    return { r: l, g: l, b: l };
  } else {
    const p = l <= 0.5 ? l * (1 + s) : l + s - l * s;
    const q = 2 * l - p;

    return {
      r: hue2RGB(q, p, h + 1 / 3),
      g: hue2RGB(q, p, h),
      b: hue2RGB(q, p, h - 1 / 3),
    };
  }
}

function getHSL(source: MMLColor): { h: number; s: number; l: number } {
  // h,s,l ranges are in 0.0 - 1.0

  const r = source.r,
    g = source.g,
    b = source.b;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  let hue = 0;
  let saturation = 0;
  const lightness = (min + max) / 2.0;

  if (min === max) {
    hue = 0;
    saturation = 0;
  } else {
    const delta = max - min;

    saturation = lightness <= 0.5 ? delta / (max + min) : delta / (2 - max - min);

    switch (max) {
      case r:
        hue = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        hue = (b - r) / delta + 2;
        break;
      case b:
        hue = (r - g) / delta + 4;
        break;
    }

    hue /= 6;
  }

  return {
    h: hue,
    s: saturation,
    l: lightness,
  };
}
