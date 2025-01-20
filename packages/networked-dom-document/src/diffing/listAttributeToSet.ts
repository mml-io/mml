export function listAttributeToSet(attr?: string | null): Set<number> {
  if (attr === null || attr === undefined || attr === "") {
    return new Set();
  }
  let hasInvalid = false;
  const entries = attr
    .split(/[\s,]+/)
    .map((x) => {
      // Must be an integer as a string (i.e. not 2.5 parsed as 2) or it is ignored
      // Checked with a regex to ensure it is a positive integer
      if (/^-?[0-9]\d*$/.test(x)) {
        return parseInt(x, 10);
      }
      hasInvalid = true;
      return null;
    })
    .filter((x) => x !== null);
  if (entries.length === 0 && hasInvalid) {
    // In the case of only invalid entries, return -1 to ensure the set is not interpreted as intentionally empty
    return new Set([-1]);
  }
  return new Set(entries);
}
