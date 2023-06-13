/**
 * @jest-environment jsdom
 */

import { AudioContext } from "standardized-audio-context-mock";

import { Group } from "../src/elements/Group";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";
import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMScene } from "../src/FullScreenMScene";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";

beforeAll(() => {
  (window as any).AudioContext = AudioContext;
  registerCustomElementsToWindow(window);
});

describe("m-group", () => {
  test("test attachment to scene", () => {
    const scene = new FullScreenMScene();
    const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;
    sceneAttachment.setMScene(scene);
    document.body.append(sceneAttachment);

    const element = document.createElement("m-group") as Group;
    sceneAttachment.append(element);

    expect(scene.getThreeScene().children[0].children[0].children[0]).toBe(
      element.getContainer(),
    );

    // Setting scale attribute - should affect the container of the element, but not the mesh itself
    expect(element.getContainer().scale.x).toBe(1);
    element.setAttribute("sx", "5");
    expect(element.getContainer().scale.x).toBe(5);
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-group", Group);
    expect(schema.name).toEqual(Group.tagName);
  });
});
