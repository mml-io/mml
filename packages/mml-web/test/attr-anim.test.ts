import { jest } from "@jest/globals";
import { StandaloneThreeJSAdapter } from "@mml-io/mml-web-three-client";
import * as THREE from "three";

import { AttributeAnimation, Cube, registerCustomElementsToWindow } from "../build/index";
import { createSceneAttachedElement, createTestScene } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-attr-anim", () => {
  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-attr-anim", AttributeAnimation);
    expect(schema.name).toEqual(AttributeAnimation.tagName);
  });

  test("test attachment to scene", async () => {
    const { scene, element } = await createSceneAttachedElement<AttributeAnimation>("m-attr-anim");
    expect(
      (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
        .children[0 /* root container */].children[0 /* attachment container */]
        .children[0 /* element container */],
    ).toBe(element.getContainer());
  });

  test("animates parent element attribute - add and remove", async () => {
    const { remoteDocument } = await createTestScene();
    const cube = document.createElement("m-cube") as Cube;
    cube.setAttribute("x", "0");
    cube.setAttribute("y", "2");
    remoteDocument.getDocumentTimeManager().overrideDocumentTime(0);

    const didUpdateTransformationSpy = jest.spyOn(cube as any, "didUpdateTransformation");
    remoteDocument.append(cube);
    expect(didUpdateTransformationSpy).toHaveBeenCalledTimes(1);
    cube.setAttribute("x", "1");
    expect(didUpdateTransformationSpy).toHaveBeenCalledTimes(2);

    const container = cube.getContainer() as THREE.Object3D;
    expect(container.position.x).toEqual(1);
    expect(container.position.y).toEqual(2);

    const attrAnim = document.createElement("m-attr-anim") as AttributeAnimation;
    attrAnim.setAttribute("attr", "x");
    attrAnim.setAttribute("start", "10");
    attrAnim.setAttribute("end", "20");
    attrAnim.setAttribute("loop", "false");
    attrAnim.setAttribute("duration", "1000");
    cube.append(attrAnim);

    // Halfway through the animation
    remoteDocument.getDocumentTimeManager().overrideDocumentTime(500);
    remoteDocument.tick();
    expect(container.position.x).toEqual(15);
    expect(container.position.y).toEqual(2);
    expect(didUpdateTransformationSpy).toHaveBeenCalledTimes(3);

    // Animation finishes
    remoteDocument.getDocumentTimeManager().overrideDocumentTime(1000);
    remoteDocument.tick();
    expect(container.position.x).toEqual(20);
    expect(container.position.y).toEqual(2);
    expect(didUpdateTransformationSpy).toHaveBeenCalledTimes(4);

    // Animation remains finished - the value should not be repeatedly set
    remoteDocument.getDocumentTimeManager().overrideDocumentTime(1500);
    remoteDocument.tick();
    expect(container.position.x).toEqual(20);
    expect(container.position.y).toEqual(2);
    expect(didUpdateTransformationSpy).toHaveBeenCalledTimes(4);

    // Removing the animation element should reset the value of the parent to the attribute value
    attrAnim.remove();
    remoteDocument.tick();
    expect(container.position.x).toEqual(1);
    expect(container.position.y).toEqual(2);
    expect(didUpdateTransformationSpy).toHaveBeenCalledTimes(5);
  });

  test("animates element attribute back to default on removal and no element value", async () => {
    const { remoteDocument } = await createTestScene();
    const cube = document.createElement("m-cube") as Cube;
    remoteDocument.getDocumentTimeManager().overrideDocumentTime(0);

    const didUpdateTransformationSpy = jest.spyOn(cube as any, "didUpdateTransformation");
    remoteDocument.append(cube);
    expect(didUpdateTransformationSpy).toHaveBeenCalledTimes(0);

    const attrAnim = document.createElement("m-attr-anim") as AttributeAnimation;
    attrAnim.setAttribute("attr", "sx");
    attrAnim.setAttribute("start", "10");
    attrAnim.setAttribute("end", "20");
    attrAnim.setAttribute("loop", "false");
    attrAnim.setAttribute("duration", "1000");
    cube.append(attrAnim);

    // Halfway through the animation
    remoteDocument.getDocumentTimeManager().overrideDocumentTime(500);
    remoteDocument.tick();

    const container = cube.getContainer() as THREE.Object3D;
    expect(container.scale.x).toEqual(15);
    expect(didUpdateTransformationSpy).toHaveBeenCalledTimes(1);

    // Animation finishes
    remoteDocument.getDocumentTimeManager().overrideDocumentTime(1000);
    remoteDocument.tick();
    expect(container.scale.x).toEqual(20);
    expect(didUpdateTransformationSpy).toHaveBeenCalledTimes(2);

    // Animation remains finished - the value should not be repeatedly set
    remoteDocument.getDocumentTimeManager().overrideDocumentTime(1500);
    remoteDocument.tick();
    expect(container.scale.x).toEqual(20);
    expect(didUpdateTransformationSpy).toHaveBeenCalledTimes(2);

    // Removing the animation element should reset the value to the default (1) because there is no element attribute
    attrAnim.remove();
    remoteDocument.tick();
    expect(container.scale.x).toEqual(1);
    expect(didUpdateTransformationSpy).toHaveBeenCalledTimes(3);
  });
});
