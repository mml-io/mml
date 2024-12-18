import { jest } from "@jest/globals";
import { StandaloneThreeJSAdapter } from "@mml-io/mml-web-threejs-standalone";

import { Prompt, registerCustomElementsToWindow } from "../build/index";
import { createSceneAttachedElement } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-prompt", () => {
  test("test attachment to scene", async () => {
    const { scene } = await createSceneAttachedElement<Prompt>("m-prompt");
    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    expect(container).toBeDefined();
  });

  test("clicking child element should trigger prompt", async () => {
    const { element, scene } = await createSceneAttachedElement<Prompt>("m-prompt");
    element.setAttribute("message", "some-message");
    element.setAttribute("placeholder", "some-placeholder");
    element.setAttribute("prefill", "some-prefill");
    const child = document.createElement("m-cube");
    element.append(child);
    const promptSpy = jest.spyOn(scene, "prompt");
    child.dispatchEvent(
      new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(promptSpy).toHaveBeenCalledWith(
      {
        message: "some-message",
        placeholder: "some-placeholder",
        prefill: "some-prefill",
      },
      expect.any(AbortSignal),
      expect.any(Function),
    );
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-prompt", Prompt);
    expect(schema.name).toEqual(Prompt.tagName);
  });
});
