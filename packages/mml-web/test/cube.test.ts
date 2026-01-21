import { StandaloneThreeJSAdapter } from "@mml-io/mml-web-threejs-standalone";
import * as THREE from "three";
import { vi } from "vitest";

import { Cube, registerCustomElementsToWindow } from "../build/index";
import { createSceneAttachedElement, createTestScene } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-cube", () => {
  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-cube", Cube);
    expect(schema.name).toEqual(Cube.tagName);
  });

  test("test attachment to scene", async () => {
    const { scene, element } = await createSceneAttachedElement<Cube>("m-cube");

    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    const cubeMesh = container.children[0 /* element mesh */] as THREE.Mesh;
    expect(cubeMesh).toBeDefined();
    expect(element.getContainer()).toBe(container);
  });

  test("sx, sy, sz", async () => {
    const { scene, element } = await createSceneAttachedElement<Cube>("m-cube");

    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    const cubeMesh = container.children[0 /* element mesh */] as THREE.Mesh;

    expect(container.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(cubeMesh.scale).toMatchObject({ x: 1, y: 1, z: 1 });

    element.setAttribute("sx", "5");
    element.setAttribute("sy", "6");
    element.setAttribute("sz", "7");

    // Setting scale attributes should affect the container of the element, but not the (cube) mesh itself
    expect(container.scale).toMatchObject({ x: 5, y: 6, z: 7 });
    expect(cubeMesh.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(cubeMesh.getWorldScale(new THREE.Vector3())).toMatchObject({
      x: 5,
      y: 6,
      z: 7,
    });

    // Removing the scale should return the element to its default scale
    element.removeAttribute("sx");
    element.removeAttribute("sy");
    element.removeAttribute("sz");
    expect(container.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(cubeMesh.scale).toMatchObject({ x: 1, y: 1, z: 1 });
  });

  test("width, height, depth", async () => {
    const { scene, element } = await createSceneAttachedElement<Cube>("m-cube");

    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    const cubeMesh = container.children[0 /* element mesh */] as THREE.Mesh;

    expect(container.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(cubeMesh.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    element.setAttribute("width", "5");
    element.setAttribute("height", "6");
    element.setAttribute("depth", "7");

    // Setting the width, height, and depth attributes should affect the (cube) mesh, but not the container
    expect(container.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(cubeMesh.scale).toMatchObject({ x: 5, y: 6, z: 7 });
    expect(cubeMesh.getWorldScale(new THREE.Vector3())).toMatchObject({
      x: 5,
      y: 6,
      z: 7,
    });

    // Removing the width, height, and depth should return the element to its default scale
    element.removeAttribute("width");
    element.removeAttribute("height");
    element.removeAttribute("depth");
    expect(container.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(cubeMesh.scale).toMatchObject({ x: 1, y: 1, z: 1 });
  });

  test("width and scale", async () => {
    const { scene, element } = await createSceneAttachedElement<Cube>("m-cube");

    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    const cubeMesh = container.children[0 /* element mesh */] as THREE.Mesh;

    expect(container.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(cubeMesh.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    element.setAttribute("sx", "2");
    element.setAttribute("width", "3");

    // Setting the width, height, and depth attributes should affect the (cube) mesh, but not the container
    expect(container.scale).toMatchObject({ x: 2, y: 1, z: 1 });
    expect(cubeMesh.scale).toMatchObject({ x: 3, y: 1, z: 1 });
    expect(cubeMesh.getWorldScale(new THREE.Vector3())).toMatchObject({
      x: 6,
      y: 1,
      z: 1,
    });
  });

  test("color", async () => {
    const { scene, element } = await createSceneAttachedElement<Cube>("m-cube");

    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    const cubeMesh = container.children[0 /* element mesh */] as THREE.Mesh;

    expect((cubeMesh.material as THREE.MeshStandardMaterial).color).toMatchObject({
      r: 1,
      g: 1,
      b: 1,
    });

    // Color set as string should be parsed to a playcanvas.Color
    element.setAttribute("color", "red");
    expect((cubeMesh.material as THREE.MeshStandardMaterial).color).toMatchObject({
      r: 1,
      g: 0,
      b: 0,
    });

    // Removing the attribute should return the color to the default (white)
    element.removeAttribute("color");
    expect((cubeMesh.material as THREE.MeshStandardMaterial).color).toMatchObject({
      r: 1,
      g: 1,
      b: 1,
    });
  });

  test("collide - remove and add", async () => {
    const { scene, remoteDocument } = await createTestScene();
    const element = document.createElement("m-cube") as Cube;
    const addColliderSpy = vi.spyOn(scene, "addCollider");
    const updateColliderSpy = vi.spyOn(scene, "updateCollider");
    const removeColliderSpy = vi.spyOn(scene, "removeCollider");

    expect(Array.from((scene as any).colliders)).toEqual([]);
    remoteDocument.append(element);

    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    const cubeMesh = container.children[0 /* element mesh */] as THREE.Mesh;

    expect(Array.from((scene as any).colliders)).toEqual([cubeMesh]);
    expect(addColliderSpy).toHaveBeenCalledTimes(1);
    expect(updateColliderSpy).toHaveBeenCalledTimes(0);
    expect(removeColliderSpy).toHaveBeenCalledTimes(0);
    expect(addColliderSpy).toHaveBeenCalledWith(cubeMesh, element);

    element.setAttribute("collide", "false");
    expect(addColliderSpy).toHaveBeenCalledTimes(1);
    expect(updateColliderSpy).toHaveBeenCalledTimes(0);
    expect(removeColliderSpy).toHaveBeenCalledTimes(1);
    expect(removeColliderSpy).toHaveBeenCalledWith(cubeMesh, element);
    expect(Array.from((scene as any).colliders)).toEqual([]);

    element.setAttribute("collide", "true");
    expect(addColliderSpy).toHaveBeenCalledTimes(2);
    expect(updateColliderSpy).toHaveBeenCalledTimes(0);
    expect(removeColliderSpy).toHaveBeenCalledTimes(1);
    expect(Array.from((scene as any).colliders)).toEqual([cubeMesh]);
    expect(addColliderSpy).toHaveBeenNthCalledWith(2, cubeMesh, element);
  });

  test("collide - update", async () => {
    const { scene, element } = await createSceneAttachedElement<Cube>("m-cube");

    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    const cubeMesh = container.children[0 /* element mesh */] as THREE.Mesh;

    expect(Array.from((scene as any).colliders)).toEqual([cubeMesh]);
    expect(Array.from((scene as any).colliders)).toEqual([cubeMesh]);

    const updateColliderSpy = vi.spyOn(scene, "updateCollider");
    expect(updateColliderSpy).toHaveBeenCalledTimes(0);

    element.setAttribute("y", "1");
    expect(updateColliderSpy).toHaveBeenCalledTimes(1);
    expect(updateColliderSpy).toHaveBeenCalledWith(cubeMesh, element);

    element.setAttribute("color", "red");
    // Should not have called updateCollider again
    expect(updateColliderSpy).toHaveBeenCalledTimes(1);

    expect(Array.from((scene as any).colliders)).toEqual([cubeMesh]);
  });

  test("collide - update from ancestor", async () => {
    const { scene, element } = await createSceneAttachedElement<Cube>("m-group");

    const addColliderSpy = vi.spyOn(scene, "addCollider");
    const updateColliderSpy = vi.spyOn(scene, "updateCollider");

    const innerGroup = document.createElement("m-group");
    element.appendChild(innerGroup);

    const mCube = document.createElement("m-cube") as Cube;
    mCube.setAttribute("x", "1");
    mCube.setAttribute("y", "2");
    mCube.setAttribute("z", "3");
    innerGroup.appendChild(mCube);

    const cubeContainer = mCube.getContainer() as THREE.Object3D;
    const cubeMesh = cubeContainer.children[0 /* element mesh */] as THREE.Mesh;

    expect(updateColliderSpy).toHaveBeenCalledTimes(0);
    expect(Array.from((scene as any).colliders)).toEqual([cubeMesh]);

    // y should be increased by one due to the parent group - should now be 3
    element.setAttribute("y", "1");
    expect(updateColliderSpy).toHaveBeenCalledTimes(1);
    expect(updateColliderSpy).toHaveBeenCalledWith(cubeMesh, mCube);
    const worldPos = new THREE.Vector3();
    cubeMesh!.getWorldPosition(worldPos);
    expect(worldPos).toMatchObject({ x: 1, y: 3, z: 3 });

    innerGroup.setAttribute("z", "1");
    expect(updateColliderSpy).toHaveBeenCalledTimes(2);
    expect(updateColliderSpy).toHaveBeenNthCalledWith(2, cubeMesh, mCube);
    expect(addColliderSpy).toHaveBeenCalledTimes(1);
    cubeMesh!.getWorldPosition(worldPos);
    // z should be increased by one due to the parent group - should now be 4
    expect(worldPos).toMatchObject({ x: 1, y: 3, z: 4 });

    expect(Array.from((scene as any).colliders)).toEqual([cubeMesh]);
  });
});
