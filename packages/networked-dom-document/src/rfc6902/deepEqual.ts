export function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    return a.every((elem, index) => {
      return deepEqual(elem, b[index]);
    });
  }

  if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
    if (Array.isArray(a) || Array.isArray(b)) {
      return false;
    }

    const keys1 = Object.keys(a);
    const keys2 = Object.keys(b);
    if (keys1.length !== keys2.length || !keys1.every((key) => keys2.includes(key))) {
      return false;
    }

    for (const key in a) {
      if (!deepEqual(a[key], b[key])) {
        return false;
      }
    }

    if (keys1.length === 0 && a instanceof Date && b instanceof Date) {
      // Only need to check the length of 1 as they are already known to be equal
      return a.getTime() === b.getTime();
    }

    return true;
  }
  return false;
}
