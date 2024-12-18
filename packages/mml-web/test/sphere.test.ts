import { StandaloneThreeJSAdapter } from "@mml-io/mml-web-threejs-standalone";
import * as THREE from "three";

import { registerCustomElementsToWindow } from "../build/index";
import { Sphere } from "../build/index";
import { createSceneAttachedElement } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-sphere", () => {
  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-sphere", Sphere);
    expect(schema.name).toEqual(Sphere.tagName);
  });

  test("test attachment to scene", async () => {
    const { scene, element } = await createSceneAttachedElement<Sphere>("m-sphere");
    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    const sphereMesh = container.children[0 /* element mesh */] as THREE.Mesh;
    expect(sphereMesh).toBeDefined();
    expect(element.getContainer()).toBe(container);
  });

  test("sx, sy, sz", async () => {
    const { scene, element } = await createSceneAttachedElement<Sphere>("m-sphere");

    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    const sphereMesh = container.children[0 /* element mesh */] as THREE.Mesh;

    expect(element.getContainer()).toBe(container);
    expect(container.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(sphereMesh.scale).toMatchObject({ x: 1, y: 1, z: 1 });

    element.setAttribute("sx", "5");
    element.setAttribute("sy", "6");
    element.setAttribute("sz", "7");

    // Setting scale attributes should affect the container of the element, but not the (sphere) mesh itself
    expect(container.scale).toMatchObject({ x: 5, y: 6, z: 7 });
    expect(sphereMesh.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(sphereMesh.getWorldScale(new THREE.Vector3())).toMatchObject({
      x: 5,
      y: 6,
      z: 7,
    });

    // Removing the scale should return the element to its default scale
    element.removeAttribute("sx");
    element.removeAttribute("sy");
    element.removeAttribute("sz");
    expect(container.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(sphereMesh.scale).toMatchObject({ x: 1, y: 1, z: 1 });
  });

  test("radius", async () => {
    const { scene, element } = await createSceneAttachedElement<Sphere>("m-sphere");

    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    const sphereMesh = container.children[0 /* element mesh */] as THREE.Mesh;

    expect(container.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(sphereMesh.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    element.setAttribute("radius", "5");

    // Setting the radius attribute should affect the (sphere) mesh, but not the container
    expect(container.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(sphereMesh.scale).toMatchObject({ x: 10, y: 10, z: 10 });
    expect(sphereMesh.getWorldScale(new THREE.Vector3())).toMatchObject({
      x: 10,
      y: 10,
      z: 10,
    });

    // Removing the radius should return the element to its default scale
    element.removeAttribute("radius");
    expect(container.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(sphereMesh.scale).toMatchObject({ x: 1, y: 1, z: 1 });
  });

  test("radius and scale", async () => {
    const { scene, element } = await createSceneAttachedElement<Sphere>("m-sphere");

    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    const sphereMesh = container.children[0 /* element mesh */] as THREE.Mesh;

    expect(container.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(sphereMesh.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    element.setAttribute("sx", "2");
    element.setAttribute("radius", "3");

    // Setting the radius attribute should affect the (sphere) mesh, but not the container
    expect(container.scale).toMatchObject({ x: 2, y: 1, z: 1 });
    expect(sphereMesh.scale).toMatchObject({ x: 6, y: 6, z: 6 });
    expect(sphereMesh.getWorldScale(new THREE.Vector3())).toMatchObject({
      x: 12,
      y: 6,
      z: 6,
    });
  });

  test("color", async () => {
    const { scene, element } = await createSceneAttachedElement<Sphere>("m-sphere");

    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    const sphereMesh = container.children[0 /* element mesh */] as THREE.Mesh;

    expect((sphereMesh.material as THREE.MeshStandardMaterial).color).toMatchObject({
      r: 1,
      g: 1,
      b: 1,
    });

    // Color set as string should be parsed to a playcanvas.Color
    element.setAttribute("color", "red");
    expect((sphereMesh.material as THREE.MeshStandardMaterial).color).toMatchObject({
      r: 1,
      g: 0,
      b: 0,
    });

    // Removing the attribute should return the color to the default (white)
    element.removeAttribute("color");
    expect((sphereMesh.material as THREE.MeshStandardMaterial).color).toMatchObject({
      r: 1,
      g: 1,
      b: 1,
    });
  });
});
