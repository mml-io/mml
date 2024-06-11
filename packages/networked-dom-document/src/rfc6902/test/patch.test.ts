import { resultName } from "./_index";
import { applyPatch } from "../index";

describe("patch", () => {
  test("broken add", () => {
    const user = { id: "chbrown" };
    const results = applyPatch(user, [{ op: "add", path: "/a/b", value: 1 }]);
    expect(user).toEqual({ id: "chbrown" }); // should change nothing
    expect(results.map(resultName)).toEqual(["MissingError"]); // should result in MissingError
  });

  test("broken remove", () => {
    const user = { id: "chbrown" };
    const results = applyPatch(user, [{ op: "remove", path: "/name" }]);
    expect(user).toEqual({ id: "chbrown" }); // should change nothing
    expect(results.map(resultName)).toEqual(["MissingError"]); // should result in MissingError
  });

  test("broken replace", () => {
    const user = { id: "chbrown" };
    const results = applyPatch(user, [{ op: "replace", path: "/name", value: 1 }]);
    expect(user).toEqual({ id: "chbrown" }); // should change nothing
    expect(results.map(resultName)).toEqual(["MissingError"]); // should result in MissingError
  });

  test("broken replace (array)", () => {
    const users = [{ id: "chbrown" }];
    const results = applyPatch(users, [{ op: "replace", path: "/1", value: { id: "chbrown2" } }]);
    // cf. issues/36
    expect(users).toEqual([{ id: "chbrown" }]); // should change nothing
    expect(results.map(resultName)).toEqual(["MissingError"]); // should result in MissingError
  });

  test("broken move (from)", () => {
    const user = { id: "chbrown" };
    const results = applyPatch(user, [{ op: "move", from: "/name", path: "/id" }]);
    expect(user).toEqual({ id: "chbrown" }); // should change nothing
    expect(results.map(resultName)).toEqual(["MissingError"]); // should result in MissingError
  });

  test("broken move (path)", () => {
    const user = { id: "chbrown" };
    const results = applyPatch(user, [{ op: "move", from: "/id", path: "/a/b" }]);
    expect(user).toEqual({ id: "chbrown" }); // should change nothing
    expect(results.map(resultName)).toEqual(["MissingError"]); // should result in MissingError
  });

  test("broken copy (from)", () => {
    const user = { id: "chbrown" };
    const results = applyPatch(user, [{ op: "copy", from: "/name", path: "/id" }]);
    expect(user).toEqual({ id: "chbrown" }); // should change nothing
    expect(results.map(resultName)).toEqual(["MissingError"]); // should result in MissingError
  });

  test("broken copy (path)", () => {
    const user = { id: "chbrown" };
    const results = applyPatch(user, [{ op: "copy", from: "/id", path: "/a/b" }]);
    expect(user).toEqual({ id: "chbrown" }); // should change nothing
    expect(results.map(resultName)).toEqual(["MissingError"]); // should result in MissingError
  });
});
