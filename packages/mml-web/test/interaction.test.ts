/**
 * @jest-environment jsdom
 */

import { AudioContext } from "standardized-audio-context-mock";
import * as THREE from "three";

import { createSceneAttachedElement, createTestScene } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { Interaction } from "../src/elements/Interaction";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";

beforeAll(() => {
  (window as any).AudioContext = AudioContext;
  registerCustomElementsToWindow(window);
});

describe("m-interaction", () => {
  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-interaction", Interaction);
    expect(schema.name).toEqual(Interaction.tagName);
  });

  test("test attachment to scene", () => {
    const { scene, element } = createSceneAttachedElement<Interaction>("m-interaction");
    expect(
      scene.getThreeScene().children[0 /* root container */].children[0 /* attachment container */]
        .children[0 /* element container */],
    ).toBe(element.getContainer());
  });

  test("interaction - add and remove", () => {
    const { scene, sceneAttachment } = createTestScene();
    const element = document.createElement("m-interaction") as Interaction;
    expect(Array.from((scene as any).interactions)).toEqual([]);
    const addInteractionSpy = jest.spyOn(scene, "addInteraction");
    const removeInteractionSpy = jest.spyOn(scene, "removeInteraction");
    sceneAttachment.append(element);

    expect(addInteractionSpy).toHaveBeenCalledTimes(1);
    expect(addInteractionSpy).toHaveBeenCalledWith(element);
    expect(removeInteractionSpy).toHaveBeenCalledTimes(0);
    expect(Array.from((scene as any).interactions)).toEqual([element]);

    element.remove();
    expect(Array.from((scene as any).interactions)).toEqual([]);
    expect(addInteractionSpy).toHaveBeenCalledTimes(1);
    expect(removeInteractionSpy).toHaveBeenCalledTimes(1);
    expect(removeInteractionSpy).toHaveBeenCalledWith(element);
  });

  test("interaction - update", () => {
    const { scene, sceneAttachment } = createTestScene();
    const element = document.createElement("m-interaction") as Interaction;
    expect(Array.from((scene as any).interactions)).toEqual([]);
    const addInteractionSpy = jest.spyOn(scene, "addInteraction");
    const updateInteractionSpy = jest.spyOn(scene, "updateInteraction");
    sceneAttachment.append(element);

    expect(addInteractionSpy).toHaveBeenCalledTimes(1);
    expect(addInteractionSpy).toHaveBeenCalledWith(element);
    expect(updateInteractionSpy).toHaveBeenCalledTimes(0);
    expect(Array.from((scene as any).interactions)).toEqual([element]);

    element.setAttribute("y", "1");
    expect(updateInteractionSpy).toHaveBeenCalledTimes(1);
    expect(updateInteractionSpy).toHaveBeenCalledWith(element);
    expect(addInteractionSpy).toHaveBeenCalledTimes(1);

    expect(Array.from((scene as any).interactions)).toEqual([element]);
  });

  test("interaction - update from ancestor", () => {
    const { element, scene } = createSceneAttachedElement<Interaction>("m-group");

    const addInteractionSpy = jest.spyOn(scene, "addInteraction");
    const updateInteractionSpy = jest.spyOn(scene, "updateInteraction");

    const innerGroup = document.createElement("m-group");
    element.appendChild(innerGroup);

    const mInteraction = document.createElement("m-interaction") as Interaction;
    mInteraction.setAttribute("x", "1");
    mInteraction.setAttribute("y", "2");
    mInteraction.setAttribute("z", "3");
    innerGroup.appendChild(mInteraction);

    expect(addInteractionSpy).toHaveBeenCalledTimes(1);
    expect(addInteractionSpy).toHaveBeenCalledWith(mInteraction);
    expect(updateInteractionSpy).toHaveBeenCalledTimes(0);
    expect(Array.from((scene as any).interactions)).toEqual([mInteraction]);

    // y should be increased by one due to the parent group - should now be 3
    element.setAttribute("y", "1");
    expect(updateInteractionSpy).toHaveBeenCalledTimes(1);
    expect(updateInteractionSpy).toHaveBeenCalledWith(mInteraction);
    expect(addInteractionSpy).toHaveBeenCalledTimes(1);
    const worldPos = new THREE.Vector3();
    mInteraction.getContainer().getWorldPosition(worldPos);
    expect(worldPos).toMatchObject({ x: 1, y: 3, z: 3 });

    innerGroup.setAttribute("z", "1");
    expect(updateInteractionSpy).toHaveBeenCalledTimes(2);
    expect(updateInteractionSpy).toHaveBeenNthCalledWith(2, mInteraction);
    expect(addInteractionSpy).toHaveBeenCalledTimes(1);
    mInteraction.getContainer().getWorldPosition(worldPos);
    // z should be increased by one due to the parent group - should now be 4
    expect(worldPos).toMatchObject({ x: 1, y: 3, z: 4 });

    expect(Array.from((scene as any).interactions)).toEqual([mInteraction]);
  });
});
