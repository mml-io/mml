import { StandaloneThreeJSAdapter } from "@mml-io/mml-web-threejs-standalone";
import { vi } from "vitest";

import { Link, registerCustomElementsToWindow } from "../build/index";
import { createSceneAttachedElement } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-link", () => {
  test("test attachment to scene", async () => {
    const { scene } = await createSceneAttachedElement<Link>("m-link");
    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    expect(container).toBeDefined();
  });

  test("clicking child element should trigger link", async () => {
    const { element, scene } = await createSceneAttachedElement<Link>("m-link");
    element.setAttribute("href", "http://example.com");
    const child = document.createElement("m-cube");
    element.append(child);
    const linkSpy = vi.spyOn(scene, "link");
    child.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(linkSpy).toHaveBeenCalledWith(
      {
        href: "http://example.com",
        target: undefined,
        popup: false,
      },
      expect.any(AbortSignal),
      expect.any(Function),
    );
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-link", Link);
    expect(schema.name).toEqual(Link.tagName);
  });

  test("isAcceptableHref", () => {
    expect(Link.isAcceptableHref("http://example.com")).toBe(true);
    expect(Link.isAcceptableHref("https://example.com")).toBe(true);
    expect(Link.isAcceptableHref("https://example.com/foo")).toBe(true);
    expect(Link.isAcceptableHref("/foo")).toBe(true);
    expect(Link.isAcceptableHref("/")).toBe(true);

    expect(Link.isAcceptableHref("ftp://example.com")).toBe(false);
    expect(Link.isAcceptableHref("javascript:alert('foo')")).toBe(false);
    expect(Link.isAcceptableHref("mailto:test@example.com")).toBe(false);
  });
});
