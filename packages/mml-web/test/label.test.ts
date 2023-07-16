/**
 * @jest-environment jsdom
 */

import { AudioContext } from "standardized-audio-context-mock";

import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { Label } from "../src/elements/Label";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";
import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMScene } from "../src/FullScreenMScene";

beforeAll(() => {
  (window as any).AudioContext = AudioContext;
  registerCustomElementsToWindow(window);
});

describe("m-label", () => {
  test("test attachment to scene", () => {
    const scene = new FullScreenMScene();
    const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;
    sceneAttachment.init(scene, "ws://localhost:8080");
    document.body.append(sceneAttachment);

    const element = document.createElement("m-label") as Label;
    sceneAttachment.append(element);

    expect(scene.getThreeScene().children[0].children[0].children[0].children[0]).toBe(
      element.getLabel(),
    );

    expect(scene.getThreeScene()).toMatchObject({
      // Scene
      children: [
        // Scene Root Container
        {
          children: [
            // Scene Attachment Container
            {
              children: [
                // Element Container
                {
                  children: expect.arrayContaining([element.getLabel()]),
                },
              ],
            },
          ],
        },
      ],
    });

    // Setting scale attribute - should affect the container of the element, but not the mesh itself
    expect(element.getContainer().scale.x).toBe(1);
    element.setAttribute("sx", "5");
    expect(element.getContainer().scale.x).toBe(5);

    // Setting the width attribute - should affect the mesh
    expect(element.getLabel().scale.x).toBe(1);
    element.setAttribute("width", "5");
    expect(element.getLabel().scale.x).toBe(5);
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-label", Label);
    expect(schema.name).toEqual(Label.tagName);
  });
});
