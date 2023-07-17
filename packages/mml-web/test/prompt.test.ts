/**
 * @jest-environment jsdom
 */

import { AudioContext } from "standardized-audio-context-mock";

import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { Prompt } from "../src/elements/Prompt";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";
import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMScene } from "../src/FullScreenMScene";

beforeAll(() => {
  (window as any).AudioContext = AudioContext;
  registerCustomElementsToWindow(window);
});

describe("m-prompt", () => {
  test("test attachment to scene", () => {
    const scene = new FullScreenMScene();
    const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;
    sceneAttachment.init(scene, "ws://localhost:8080");
    document.body.append(sceneAttachment);

    const element = document.createElement("m-prompt") as Prompt;
    sceneAttachment.append(element);

    expect(scene.getThreeScene().children[0].children[0].children[0]).toBe(
      element.getContainer(),
    );

    expect(scene.getThreeScene()).toMatchObject({
      // Scene
      children: [
        // Scene Root Container
        {
          children: [
            // Scene Attachment Container
            {
              children: expect.arrayContaining([element.getContainer()]),
            },
          ],
        },
      ],
    });

    // Setting scale attribute - should affect the container of the element, but not the mesh itself
    expect(element.getContainer().scale.x).toBe(1);
    element.setAttribute("sx", "5");
    expect(element.getContainer().scale.x).toBe(5);
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-prompt", Prompt);
    expect(schema.name).toEqual(Prompt.tagName);
  });
});
