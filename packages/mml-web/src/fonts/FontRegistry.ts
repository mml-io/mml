let defaultCanvasFontFamily: string | undefined;

export function setDefaultCanvasFontFamily(family: string | undefined) {
  defaultCanvasFontFamily = family;
}

export function getDefaultCanvasFontFamily(): string | undefined {
  return defaultCanvasFontFamily;
}
