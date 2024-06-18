import { applyPatch, createPatch } from "../index";
import { clone } from "../util";

const pairs = [
  [["A", "Z", "Z"], ["A"]],
  [
    ["A", "B"],
    ["B", "A"],
  ],
  [[], ["A", "B"]],
  [
    ["B", "A", "M"],
    ["M", "A", "A"],
  ],
  [["A", "A", "R"], []],
  [
    ["A", "B", "C"],
    ["B", "C", "D"],
  ],
  [
    ["A", "C"],
    ["A", "B", "C"],
  ],
  [
    ["A", "B", "C"],
    ["A", "Z"],
  ],
];

describe("arrays", () => {
  pairs.forEach(([input, output]) => {
    test(`diff+patch: [${input}] => [${output}]`, () => {
      const patch = createPatch(input, output);
      const actual_output = clone(input);
      applyPatch(actual_output, patch);
      expect(actual_output).toEqual(output); // should apply produced patch to arrive at output
    });
  });
});
