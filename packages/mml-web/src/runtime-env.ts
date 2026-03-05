export function getGlobalWindow(): (Window & typeof globalThis) | undefined {
  return typeof window !== "undefined" ? window : undefined;
}

export function getGlobalDocument(): Document | undefined {
  return typeof document !== "undefined" ? document : undefined;
}
