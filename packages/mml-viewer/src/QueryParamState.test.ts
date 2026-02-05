import { QueryParamState } from "./QueryParamState";

describe("QueryParamState", () => {
  it("should parse query string into params", () => {
    const queryParamState = new QueryParamState("foo=bar&baz=qux");
    expect(queryParamState.read("foo")).toBe("bar");
    expect(queryParamState.read("baz")).toBe("qux");
  });

  it("should return null for non-existent param", () => {
    const queryParamState = new QueryParamState("foo=bar");
    expect(queryParamState.read("baz")).toBeNull();
  });

  it("should clone with additional params", () => {
    const queryParamState = new QueryParamState("foo=bar");
    const newParams = new Map([["baz", "qux"]]);
    const clonedState = queryParamState.cloneWithAdditionalParams(newParams);
    expect(clonedState.read("foo")).toBe("bar");
    expect(clonedState.read("baz")).toBe("qux");
  });

  it("should return unused params", () => {
    const queryParamState = new QueryParamState("foo=bar&baz=qux");
    queryParamState.read("foo");
    const unusedParams = queryParamState.getUnusedParams();
    expect(unusedParams.has("baz")).toBe(true);
    expect(unusedParams.has("foo")).toBe(false);
  });

  it("should convert params to string", () => {
    const queryParamState = new QueryParamState("foo=bar&baz=qux");
    expect(queryParamState.toString()).toBe("foo=bar&baz=qux");
  });

  it("should handle empty query string", () => {
    const queryParamState = new QueryParamState("");
    expect(queryParamState.read("foo")).toBeNull();
    expect(queryParamState.getUnusedParams().size).toBe(0);
  });

  it("should handle Map input", () => {
    const params = new Map([
      ["foo", "bar"],
      ["baz", "qux"],
    ]);
    const queryParamState = new QueryParamState(params);
    expect(queryParamState.read("foo")).toBe("bar");
    expect(queryParamState.read("baz")).toBe("qux");
  });

  it("should handle keys and values with special characters", () => {
    const queryParamState = new QueryParamState("foo%20bar=baz%20qux&key%3Dvalue=val%3Due");
    expect(queryParamState.read("foo bar")).toBe("baz qux");
    expect(queryParamState.read("key=value")).toBe("val=ue");
  });

  it("should handle keys and values with encoded characters", () => {
    const queryParamState = new QueryParamState("foo%26bar=baz%26qux&key%3Fvalue=val%3Fue");
    expect(queryParamState.read("foo&bar")).toBe("baz&qux");
    expect(queryParamState.read("key?value")).toBe("val?ue");
  });

  it("should handle keys and values with spaces", () => {
    const queryParamState = new QueryParamState("foo%20bar=baz%20qux&key%20value=val%20ue");
    expect(queryParamState.read("foo bar")).toBe("baz qux");
    expect(queryParamState.read("key value")).toBe("val ue");
  });

  it("should handle keys and values with plus signs", () => {
    const queryParamState = new QueryParamState("foo+bar=baz+qux&key+value=val+ue");
    expect(queryParamState.read("foo bar")).toBe("baz qux");
    expect(queryParamState.read("key value")).toBe("val ue");
  });
});
