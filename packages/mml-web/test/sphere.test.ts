/**
 * @jest-environment jsdom
 */

import { AudioContext } from "standardized-audio-context-mock";
import * as THREE from "three";

import { createSceneAttachedElement } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";
import { Sphere } from "../src/elements/Sphere";

beforeAll(() => {
  (window as any).AudioContext = AudioContext;
  registerCustomElementsToWindow(window);
});

describe("m-sphere", () => {
  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-sphere", Sphere);
    expect(schema.name).toEqual(Sphere.tagName);
  });

  test("test attachment to scene", () => {
    const { scene, element } = createSceneAttachedElement<Sphere>("m-sphere");
    expect(
      scene.getThreeScene().children[0 /* root container */].children[0 /* attachment container */]
        .children[0 /* element container */].children[0 /* element mesh */],
    ).toBe(element.getSphere());
  });

  test("sx, sy, sz", () => {
    const { element } = createSceneAttachedElement<Sphere>("m-sphere");
    expect(element.getContainer().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getSphere().scale).toMatchObject({ x: 1, y: 1, z: 1 });

    element.setAttribute("sx", "5");
    element.setAttribute("sy", "6");
    element.setAttribute("sz", "7");

    // Setting scale attributes should affect the container of the element, but not the (sphere) mesh itself
    expect(element.getContainer().scale).toMatchObject({ x: 5, y: 6, z: 7 });
    expect(element.getSphere().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getSphere().getWorldScale(new THREE.Vector3())).toMatchObject({
      x: 5,
      y: 6,
      z: 7,
    });

    // Removing the scale should return the element to its default scale
    element.removeAttribute("sx");
    element.removeAttribute("sy");
    element.removeAttribute("sz");
    expect(element.getContainer().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getSphere().scale).toMatchObject({ x: 1, y: 1, z: 1 });
  });

  test("radius", () => {
    const { element } = createSceneAttachedElement<Sphere>("m-sphere");
    expect(element.getContainer().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getSphere().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    element.setAttribute("radius", "5");

    // Setting the radius attribute should affect the (sphere) mesh, but not the container
    expect(element.getContainer().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getSphere().scale).toMatchObject({ x: 10, y: 10, z: 10 });
    expect(element.getSphere().getWorldScale(new THREE.Vector3())).toMatchObject({
      x: 10,
      y: 10,
      z: 10,
    });

    // Removing the radius should return the element to its default scale
    element.removeAttribute("radius");
    expect(element.getContainer().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getSphere().scale).toMatchObject({ x: 1, y: 1, z: 1 });
  });

  test("radius and scale", () => {
    const { element } = createSceneAttachedElement<Sphere>("m-sphere");
    expect(element.getContainer().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getSphere().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    element.setAttribute("sx", "2");
    element.setAttribute("radius", "3");

    // Setting the radius attribute should affect the (sphere) mesh, but not the container
    expect(element.getContainer().scale).toMatchObject({ x: 2, y: 1, z: 1 });
    expect(element.getSphere().scale).toMatchObject({ x: 6, y: 6, z: 6 });
    expect(element.getSphere().getWorldScale(new THREE.Vector3())).toMatchObject({
      x: 12,
      y: 6,
      z: 6,
    });
  });

  test("color", () => {
    const { element } = createSceneAttachedElement<Sphere>("m-sphere");
    expect((element.getSphere().material as THREE.MeshStandardMaterial).color).toMatchObject({
      r: 1,
      g: 1,
      b: 1,
    });

    // Color set as string should be parsed to a THREE.Color
    element.setAttribute("color", "red");
    expect((element.getSphere().material as THREE.MeshStandardMaterial).color).toMatchObject({
      r: 1,
      g: 0,
      b: 0,
    });

    // Removing the attribute should return the color to the default (white)
    element.removeAttribute("color");
    expect((element.getSphere().material as THREE.MeshStandardMaterial).color).toMatchObject({
      r: 1,
      g: 1,
      b: 1,
    });
  });
});
