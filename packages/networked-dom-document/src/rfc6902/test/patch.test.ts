import { applyPatch } from "../index";
import { resultName } from "./_index";

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

  test("add to arrays and objects", () => {
    const payload = { users: [{ id: "a" }] };
    const results = applyPatch(payload, [
      { op: "add", path: "/users/1", value: { id: "b" } },
      { op: "add", path: "/users/-", value: { id: "c" } },
      { op: "add", path: "/group", value: "dev" },
    ]);

    expect(payload).toEqual({ users: [{ id: "a" }, { id: "b" }, { id: "c" }], group: "dev" });
    expect(results.map(resultName)).toEqual([null, null, null]);
  });

  test("remove from arrays and objects", () => {
    const payload = { users: [{ id: "a" }, { id: "b" }], group: "dev" };
    const results = applyPatch(payload, [
      { op: "remove", path: "/users/0" },
      { op: "remove", path: "/group" },
    ]);

    expect(payload).toEqual({ users: [{ id: "b" }] });
    expect(results.map(resultName)).toEqual([null, null]);
  });

  test("replace supports object and array targets", () => {
    const payload = { users: [{ id: "a" }], group: "dev" };
    const results = applyPatch(payload, [
      { op: "replace", path: "/users/0", value: { id: "b" } },
      { op: "replace", path: "/group", value: "ops" },
    ]);

    expect(payload).toEqual({ users: [{ id: "b" }], group: "ops" });
    expect(results.map(resultName)).toEqual([null, null]);
  });

  test("move and copy support nested values and clone semantics", () => {
    const payload = { source: { nested: { value: 1 } }, target: {}, copied: {} as { nested?: { value: number } } };
    const results = applyPatch(payload, [
      { op: "move", from: "/source/nested", path: "/target/nested" },
      { op: "copy", from: "/target/nested", path: "/copied/nested" },
    ]);

    expect(results.map(resultName)).toEqual([null, null]);
    expect(payload).toEqual({
      source: {},
      target: { nested: { value: 1 } },
      copied: { nested: { value: 1 } },
    });

    payload.target.nested.value = 2;
    expect(payload.copied.nested?.value).toBe(1);
  });

  test("test operation and invalid operations return expected errors", () => {
    const payload = { id: "chbrown" };
    const results = applyPatch(payload, [
      { op: "test", path: "/id", value: "chbrown" },
      { op: "test", path: "/id", value: "different" },
      { op: "invalid", path: "/id" } as any,
    ]);

    expect(payload).toEqual({ id: "chbrown" });
    expect(results.map(resultName)).toEqual([null, "TestError", "InvalidOperationError"]);
  });
});
