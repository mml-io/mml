/**
 * @jest-environment jsdom
 */

import { AudioContext } from "standardized-audio-context-mock";
import * as THREE from "three";

import { createSceneAttachedElement, createTestScene } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { Cube } from "../src/elements/Cube";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";

beforeAll(() => {
  (window as any).AudioContext = AudioContext;
  registerCustomElementsToWindow(window);
});

describe("m-cube", () => {
  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-cube", Cube);
    expect(schema.name).toEqual(Cube.tagName);
  });

  test("test attachment to scene", () => {
    const { scene, element } = createSceneAttachedElement<Cube>("m-cube");
    expect(
      scene.getThreeScene().children[0 /* root container */].children[0 /* attachment container */]
        .children[0 /* element container */].children[0 /* element mesh */],
    ).toBe(element.getCube());
  });

  test("sx, sy, sz", () => {
    const { element } = createSceneAttachedElement<Cube>("m-cube");
    expect(element.getContainer().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getCube().scale).toMatchObject({ x: 1, y: 1, z: 1 });

    element.setAttribute("sx", "5");
    element.setAttribute("sy", "6");
    element.setAttribute("sz", "7");

    // Setting scale attributes should affect the container of the element, but not the (cube) mesh itself
    expect(element.getContainer().scale).toMatchObject({ x: 5, y: 6, z: 7 });
    expect(element.getCube().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getCube().getWorldScale(new THREE.Vector3())).toMatchObject({
      x: 5,
      y: 6,
      z: 7,
    });

    // Removing the scale should return the element to its default scale
    element.removeAttribute("sx");
    element.removeAttribute("sy");
    element.removeAttribute("sz");
    expect(element.getContainer().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getCube().scale).toMatchObject({ x: 1, y: 1, z: 1 });
  });

  test("width, height, depth", () => {
    const { element } = createSceneAttachedElement<Cube>("m-cube");
    expect(element.getContainer().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getCube().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    element.setAttribute("width", "5");
    element.setAttribute("height", "6");
    element.setAttribute("depth", "7");

    // Setting the width, height, and depth attributes should affect the (cube) mesh, but not the container
    expect(element.getContainer().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getCube().scale).toMatchObject({ x: 5, y: 6, z: 7 });
    expect(element.getCube().getWorldScale(new THREE.Vector3())).toMatchObject({
      x: 5,
      y: 6,
      z: 7,
    });

    // Removing the width, height, and depth should return the element to its default scale
    element.removeAttribute("width");
    element.removeAttribute("height");
    element.removeAttribute("depth");
    expect(element.getContainer().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getCube().scale).toMatchObject({ x: 1, y: 1, z: 1 });
  });

  test("width and scale", () => {
    const { element } = createSceneAttachedElement<Cube>("m-cube");
    expect(element.getContainer().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getCube().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    element.setAttribute("sx", "2");
    element.setAttribute("width", "3");

    // Setting the width, height, and depth attributes should affect the (cube) mesh, but not the container
    expect(element.getContainer().scale).toMatchObject({ x: 2, y: 1, z: 1 });
    expect(element.getCube().scale).toMatchObject({ x: 3, y: 1, z: 1 });
    expect(element.getCube().getWorldScale(new THREE.Vector3())).toMatchObject({
      x: 6,
      y: 1,
      z: 1,
    });
  });

  test("color", () => {
    const { element } = createSceneAttachedElement<Cube>("m-cube");
    expect((element.getCube().material as THREE.MeshStandardMaterial).color).toMatchObject({
      r: 1,
      g: 1,
      b: 1,
    });

    // Color set as string should be parsed to a THREE.Color
    element.setAttribute("color", "red");
    expect((element.getCube().material as THREE.MeshStandardMaterial).color).toMatchObject({
      r: 1,
      g: 0,
      b: 0,
    });

    // Removing the attribute should return the color to the default (white)
    element.removeAttribute("color");
    expect((element.getCube().material as THREE.MeshStandardMaterial).color).toMatchObject({
      r: 1,
      g: 1,
      b: 1,
    });
  });

  test("collide - remove and add", () => {
    const { scene, sceneAttachment } = createTestScene();
    const element = document.createElement("m-cube") as Cube;
    expect(Array.from((scene as any).colliders)).toEqual([]);
    const addColliderSpy = jest.spyOn(scene, "addCollider");
    const removeColliderSpy = jest.spyOn(scene, "removeCollider");
    sceneAttachment.append(element);
    expect(Array.from((scene as any).colliders)).toEqual([element.getCube()]);
    expect(addColliderSpy).toHaveBeenCalledTimes(1);
    expect(removeColliderSpy).toHaveBeenCalledTimes(0);
    expect(addColliderSpy).toHaveBeenCalledWith(element.getCube(), element);

    element.setAttribute("collide", "false");
    expect(removeColliderSpy).toHaveBeenCalledTimes(1);
    expect(removeColliderSpy).toHaveBeenCalledWith(element.getCube(), element);
    expect(addColliderSpy).toHaveBeenCalledTimes(1);
    expect(Array.from((scene as any).colliders)).toEqual([]);

    element.setAttribute("collide", "true");
    expect(Array.from((scene as any).colliders)).toEqual([element.getCube()]);
    expect(addColliderSpy).toHaveBeenCalledTimes(2);
    expect(removeColliderSpy).toHaveBeenCalledTimes(1);
    expect(addColliderSpy).toHaveBeenCalledWith(element.getCube(), element);
  });

  test("collide - update", () => {
    const { element, scene } = createSceneAttachedElement<Cube>("m-cube");
    expect(Array.from((scene as any).colliders)).toEqual([element.getCube()]);
    expect(Array.from((scene as any).colliders)).toEqual([element.getCube()]);

    const updateColliderSpy = jest.spyOn(scene, "updateCollider");
    expect(updateColliderSpy).toHaveBeenCalledTimes(0);

    element.setAttribute("y", "1");
    expect(updateColliderSpy).toHaveBeenCalledTimes(1);
    expect(updateColliderSpy).toHaveBeenCalledWith(element.getCube(), element);

    element.setAttribute("color", "red");
    // Should not have called updateCollider again
    expect(updateColliderSpy).toHaveBeenCalledTimes(1);

    expect(Array.from((scene as any).colliders)).toEqual([element.getCube()]);
  });

  test("collide - update from ancestor", () => {
    const { element, scene } = createSceneAttachedElement<Cube>("m-group");
    const addColliderSpy = jest.spyOn(scene, "addCollider");
    const updateColliderSpy = jest.spyOn(scene, "updateCollider");

    const innerGroup = document.createElement("m-group");
    element.appendChild(innerGroup);

    const mCube = document.createElement("m-cube") as Cube;
    mCube.setAttribute("x", "1");
    mCube.setAttribute("y", "2");
    mCube.setAttribute("z", "3");
    innerGroup.appendChild(mCube);

    expect(updateColliderSpy).toHaveBeenCalledTimes(0);
    expect(Array.from((scene as any).colliders)).toEqual([mCube.getCube()]);

    // y should be increased by one due to the parent group - should now be 3
    element.setAttribute("y", "1");
    expect(updateColliderSpy).toHaveBeenCalledTimes(1);
    expect(updateColliderSpy).toHaveBeenCalledWith(mCube.getCube(), mCube);
    const worldPos = new THREE.Vector3();
    mCube.getCube().getWorldPosition(worldPos);
    expect(worldPos).toMatchObject({ x: 1, y: 3, z: 3 });

    innerGroup.setAttribute("z", "1");
    expect(updateColliderSpy).toHaveBeenCalledTimes(2);
    expect(updateColliderSpy).toHaveBeenNthCalledWith(2, mCube.getCube(), mCube);
    expect(addColliderSpy).toHaveBeenCalledTimes(1);
    mCube.getCube().getWorldPosition(worldPos);
    // z should be increased by one due to the parent group - should now be 4
    expect(worldPos).toMatchObject({ x: 1, y: 3, z: 4 });

    expect(Array.from((scene as any).colliders)).toEqual([mCube.getCube()]);
  });
});
