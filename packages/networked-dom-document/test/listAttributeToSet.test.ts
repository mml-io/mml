import { listAttributeToSet } from "../src/diffing/listAttributeToSet";

const cases: Array<[string | undefined | null, Set<number>]> = [
  ["123", new Set([123])],
  ["1 2 3", new Set([1, 2, 3])],
  ["1,2,3", new Set([1, 2, 3])],
  ["1,2 3", new Set([1, 2, 3])],
  ["0", new Set([0])],
  ["-0", new Set([0])],
  ["-1", new Set([-1])],
  ["-2", new Set([-2])],
  ["-abc", new Set([-1])],
  ["-", new Set([-1])],
  [" ", new Set([-1])],
  ["", new Set([])],
  [null, new Set([])],
  [undefined, new Set([])],
];

describe("listAttributeToSet", () => {
  test.each(cases)("given %p, returns %p", (firstArg, expectedResult) => {
    const result = listAttributeToSet(firstArg);
    expect(result).toEqual(expectedResult);
  });
});
