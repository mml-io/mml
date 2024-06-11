import specJSON from "./spec.json";
import { Operation } from "../diff";
import { applyPatch, createPatch } from "../index";
import { Pointer } from "../pointer";
import { clone } from "../util";

interface Spec {
  name: string;
  input: any;
  patch: Operation[];
  output: any;
  results: (string | null)[];
  diffable: boolean;
}

const specData: Spec[] = specJSON as Spec[];

describe("spec", () => {
  test("JSON Pointer - rfc-examples", () => {
    // > For example, given the JSON document
    const obj = {
      foo: ["bar", "baz"],
      "": 0,
      "a/b": 1,
      "c%d": 2,
      "e^f": 3,
      "g|h": 4,
      "i\\j": 5,
      "k'l": 6,
      " ": 7,
      "m~n": 8,
    };

    // > The following JSON strings evaluate to the accompanying values
    const pointers = [
      { path: "", expected: obj },
      { path: "/foo", expected: ["bar", "baz"] },
      { path: "/foo/0", expected: "bar" },
      { path: "/", expected: 0 },
      { path: "/a~1b", expected: 1 },
      { path: "/c%d", expected: 2 },
      { path: "/e^f", expected: 3 },
      { path: "/g|h", expected: 4 },
      { path: "/i\\j", expected: 5 },
      { path: "/k'l", expected: 6 },
      { path: "/ ", expected: 7 },
      { path: "/m~0n", expected: 8 },
    ];

    pointers.forEach((pointer) => {
      const actual = Pointer.fromJSON(pointer.path).evaluate(obj).value;
      expect(actual).toEqual(pointer.expected); // pointer should evaluate to expected output
    });
  });

  test("JSON Pointer - package example", () => {
    const obj = {
      first: "chris",
      last: "brown",
      github: {
        account: {
          id: "chbrown",
          handle: "@chbrown",
        },
        repos: ["amulet", "twilight", "rfc6902"],
        stars: [
          {
            owner: "raspberrypi",
            repo: "userland",
          },
          {
            owner: "angular",
            repo: "angular.js",
          },
        ],
      },
      "github/account": "deprecated",
    };

    const pointers = [
      { path: "/first", expected: "chris" },
      { path: "/github~1account", expected: "deprecated" },
      { path: "/github/account/handle", expected: "@chbrown" },
      { path: "/github/repos", expected: ["amulet", "twilight", "rfc6902"] },
      { path: "/github/repos/2", expected: "rfc6902" },
      { path: "/github/stars/0/repo", expected: "userland" },
    ];

    pointers.forEach((pointer) => {
      const actual = Pointer.fromJSON(pointer.path).evaluate(obj).value;
      expect(actual).toEqual(pointer.expected); // pointer should evaluate to expected output
    });
  });

  test("Specification format", () => {
    expect(specData.length).toEqual(19); // should have 19 items
    // use sorted values and sort() to emulate set equality
    const props = ["diffable", "input", "name", "output", "patch", "results"];
    specData.forEach((spec) => {
      expect(Object.keys(spec).sort()).toEqual(props); // should have items with specific properties
    });
  });

  // take the input, apply the patch, and check the actual result against the
  // expected output
  specData.forEach((spec) => {
    test(`patch ${spec.name}`, () => {
      // patch operations are applied to object in-place
      const actual = clone(spec.input);
      const expected = spec.output;
      const results = applyPatch(actual, spec.patch);
      expect(actual).toEqual(expected); // should equal expected output after applying patches
      // since errors are object instances, reduce them to strings to match
      // the spec's results, which has the type `Array<string | null>`
      const results_names = results.map((error) => (error ? error.name : error));
      expect(results_names).toEqual(spec.results); // should produce expected results
    });
  });

  specData
    .filter((spec) => spec.diffable)
    .forEach((spec) => {
      test(`diff ${spec.name}`, () => {
        // we read this separately because patch is destructive and it's easier just to start with a blank slate
        // ignore spec items that are marked as not diffable
        // perform diff (create patch = list of operations) and check result against non-test patches in spec
        const actual = createPatch(spec.input, spec.output);
        const expected = spec.patch.filter((operation) => operation.op !== "test");
        expect(actual).toEqual(expected); // should produce diff equal to spec patch
      });
    });
});
