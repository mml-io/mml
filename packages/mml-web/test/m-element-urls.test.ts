/**
 * @jest-environment jsdom
 */

import { AudioContext } from "standardized-audio-context-mock";
import { Cache } from "three";

import { createSceneAttachedElement } from "./scene-test-utils";
import { Cube } from "../src";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";

beforeAll(() => {
  (window as any).AudioContext = AudioContext;
  registerCustomElementsToWindow(window);
  Cache.clear();
});

describe("m-element url", () => {
  const cases = [
    ["ws://example.com:8080", "http://example.com:8080/foo/bar", "http://example.com:8080/foo/bar"],
    ["ws://example.com:8080", "/foo/bar", "http://example.com:8080/foo/bar"],
    ["ws://example.com:8080", "foo/bar", "http://example.com:8080/foo/bar"],
    ["ws://example.com:8080", "http://example.org/foo", "http://example.org/foo"],
    [
      "ws://example.com:8080/baz/",
      "http://example.com:8080/foo/bar",
      "http://example.com:8080/foo/bar",
    ],
    ["ws://example.com:8080/baz/", "/foo/bar", "http://example.com:8080/foo/bar"],
    ["ws://example.com:8080/baz/", "foo/bar", "http://example.com:8080/baz/foo/bar"],
    ["ws://example.com:8080/baz/", "http://example.org/foo", "http://example.org/foo"],

    [
      "http://example.com:8080",
      "http://example.com:8080/foo/bar",
      "http://example.com:8080/foo/bar",
    ],
    ["http://example.com:8080", "/foo/bar", "http://example.com:8080/foo/bar"],
    ["http://example.com:8080", "foo/bar", "http://example.com:8080/foo/bar"],
    ["http://example.com:8080", "http://example.org/foo", "http://example.org/foo"],
    [
      "http://example.com:8080/baz/",
      "http://example.com:8080/foo/bar",
      "http://example.com:8080/foo/bar",
    ],
    ["http://example.com:8080/baz/", "/foo/bar", "http://example.com:8080/foo/bar"],
    ["http://example.com:8080/baz/", "foo/bar", "http://example.com:8080/baz/foo/bar"],
    ["http://example.com:8080/baz/", "http://example.org/foo", "http://example.org/foo"],

    [
      "wss://example.com:8080",
      "https://example.com:8080/foo/bar",
      "https://example.com:8080/foo/bar",
    ],
    ["wss://example.com:8080", "/foo/bar", "https://example.com:8080/foo/bar"],
    ["wss://example.com:8080", "foo/bar", "https://example.com:8080/foo/bar"],
    ["wss://example.com:8080", "https://example.org/foo", "https://example.org/foo"],
    [
      "wss://example.com:8080/baz/",
      "https://example.com:8080/foo/bar",
      "https://example.com:8080/foo/bar",
    ],
    ["wss://example.com:8080/baz/", "/foo/bar", "https://example.com:8080/foo/bar"],
    ["wss://example.com:8080/baz/", "foo/bar", "https://example.com:8080/baz/foo/bar"],
    ["wss://example.com:8080/baz/", "https://example.org/foo", "https://example.org/foo"],

    [
      "https://example.com:8080",
      "http://example.com:8080/foo/bar",
      "http://example.com:8080/foo/bar",
    ],
    ["https://example.com:8080", "/foo/bar", "https://example.com:8080/foo/bar"],
    ["https://example.com:8080", "foo/bar", "https://example.com:8080/foo/bar"],
    ["https://example.com:8080", "http://example.org/foo", "http://example.org/foo"],
    [
      "https://example.com:8080/baz/",
      "https://example.com:8080/foo/bar",
      "https://example.com:8080/foo/bar",
    ],
    ["https://example.com:8080/baz/", "/foo/bar", "https://example.com:8080/foo/bar"],
    ["https://example.com:8080/baz/", "foo/bar", "https://example.com:8080/baz/foo/bar"],
    ["https://example.com:8080/baz/", "https://example.org/foo", "https://example.org/foo"],
  ];
  test.each(cases)(
    "document location %p with content %p should return %p",
    (firstArg, secondArg, expectedResult) => {
      const { element } = createSceneAttachedElement<Cube>("m-cube", firstArg);
      expect(element.contentSrcToContentAddress(secondArg)).toBe(expectedResult);
    },
  );
});
