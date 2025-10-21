export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export function chooseSubset<T>(items: readonly T[], rng: () => number): T[] {
  const result: T[] = [];
  for (const item of items) {
    if (rng() > 0.5) {
      result.push(item);
    }
  }
  if (result.length === 0 && items.length > 0) {
    result.push(items[Math.floor(rng() * items.length)]);
  }
  return result;
}

export function pickRandom<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}
