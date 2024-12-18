export function parseXYZ(str: string): [number, number, number] {
  const asNumbers = str
    .split(",")
    .slice(0, 3)
    .map(parseFloat)
    .map((v) => (isNaN(v) ? 0 : v)) as [number, number, number];
  return [asNumbers[0] || 0, asNumbers[1] || 0, asNumbers[2] || 0];
}
