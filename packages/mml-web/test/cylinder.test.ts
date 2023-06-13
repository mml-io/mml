/**
 * @jest-environment jsdom
 */

import { AudioContext } from "standardized-audio-context-mock";

import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { Cylinder } from "../src/elements/Cylinder";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";
import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMScene } from "../src/FullScreenMScene";

beforeAll(() => {
  (window as any).AudioContext = AudioContext;
  registerCustomElementsToWindow(window);
});

describe("m-cylinder", () => {
  test("test attachment to scene", () => {
    const scene = new FullScreenMScene();
    const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;
    sceneAttachment.setMScene(scene);
    document.body.append(sceneAttachment);

    const element = document.createElement("m-cylinder") as Cylinder;
    sceneAttachment.append(element);

    expect(scene.getThreeScene().children[0].children[0].children[0].children[0]).toBe(
      element.getCylinder(),
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
                  children: expect.arrayContaining([element.getCylinder()]),
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
    expect(element.getCylinder().scale.x).toBe(1);
    element.setAttribute("radius", "2.5");
    expect(element.getCylinder().scale.x).toBe(5);
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-cylinder", Cylinder);
    expect(schema.name).toEqual(Cylinder.tagName);
  });
});
