/**
 * @jest-environment jsdom
 */

import { AudioContext } from "standardized-audio-context-mock";
import * as THREE from "three";

import { createSceneAttachedElement } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { PositionProbe } from "../src/elements/PositionProbe";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";

beforeAll(() => {
  (window as any).AudioContext = AudioContext;
  registerCustomElementsToWindow(window);
});

describe("m-position-probe", () => {
  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-position-probe", PositionProbe);
    expect(schema.name).toEqual(PositionProbe.tagName);
  });

  test("test attachment to scene", () => {
    const { scene, element } = createSceneAttachedElement<PositionProbe>("m-position-probe");
    expect(
      scene.getThreeScene().children[0 /* root container */].children[0 /* attachment container */]
        .children[0 /* element container */],
    ).toBe(element.getContainer());
  });

  test("position-probe - send position", async () => {
    const { element, scene } = createSceneAttachedElement<PositionProbe>("m-position-probe");
    element.setAttribute("range", "10");
    element.setAttribute("interval", "100");

    const sendPositionSpy = jest.spyOn(scene, "getUserPositionAndRotation");
    sendPositionSpy.mockImplementation(() => ({
      position: new THREE.Vector3(1, 2, 3),
      rotation: new THREE.Euler(0, THREE.MathUtils.degToRad(45), 0),
    }));

    const enterEvent = await new Promise<CustomEvent>((resolve) => {
      element.addEventListener("positionenter", (event: CustomEvent) => {
        resolve(event);
      });
    });
    expect(enterEvent.type).toEqual("positionenter");
    expect(enterEvent.detail).toEqual({
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: expect.closeTo(0), y: expect.closeTo(45), z: expect.closeTo(0) },
    });

    // Move the position
    sendPositionSpy.mockImplementation(() => ({
      position: new THREE.Vector3(2, 4, 6),
      rotation: new THREE.Euler(0, THREE.MathUtils.degToRad(90), 0),
    }));
    const moveEvent = await new Promise<CustomEvent>((resolve) => {
      element.addEventListener("positionmove", (event: CustomEvent) => {
        resolve(event);
      });
    });
    expect(moveEvent.type).toEqual("positionmove");
    expect(moveEvent.detail).toEqual({
      position: { x: 2, y: 4, z: 6 },
      rotation: { x: expect.closeTo(0), y: expect.closeTo(90), z: expect.closeTo(0) },
    });

    // Move the position outside of the probe
    sendPositionSpy.mockImplementation(() => ({
      position: new THREE.Vector3(20, 40, 60),
      rotation: new THREE.Euler(0, THREE.MathUtils.degToRad(135), 0),
    }));
    const leaveEvent = await new Promise<CustomEvent>((resolve) => {
      element.addEventListener("positionleave", (event: CustomEvent) => {
        resolve(event);
      });
    });
    expect(leaveEvent.type).toEqual("positionleave");
  });

  test("position-probe - send position - relative", async () => {
    const { element: group, scene } = createSceneAttachedElement("m-group");

    group.setAttribute("x", "10");
    group.setAttribute("y", "20");
    group.setAttribute("z", "30");

    const element: PositionProbe = document.createElement("m-position-probe") as PositionProbe;
    element.setAttribute("range", "10");
    element.setAttribute("interval", "100");
    group.append(element);
    element.getContainer().updateWorldMatrix(true, false);

    const sendPositionSpy = jest.spyOn(scene, "getUserPositionAndRotation");
    sendPositionSpy.mockImplementation(() => ({
      position: new THREE.Vector3(11, 22, 33),
      rotation: new THREE.Euler(0, THREE.MathUtils.degToRad(45), 0),
    }));

    const enterEvent = await new Promise<CustomEvent>((resolve) => {
      element.addEventListener("positionenter", (event: CustomEvent) => {
        resolve(event);
      });
    });
    expect(enterEvent.type).toEqual("positionenter");
    expect(enterEvent.detail).toEqual({
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: expect.closeTo(0), y: expect.closeTo(45), z: expect.closeTo(0) },
    });

    // Move the position
    sendPositionSpy.mockImplementation(() => ({
      position: new THREE.Vector3(12, 24, 36),
      rotation: new THREE.Euler(0, THREE.MathUtils.degToRad(90), 0),
    }));
    const moveEvent = await new Promise<CustomEvent>((resolve) => {
      element.addEventListener("positionmove", (event: CustomEvent) => {
        resolve(event);
      });
    });
    expect(moveEvent.type).toEqual("positionmove");
    expect(moveEvent.detail).toEqual({
      position: { x: 2, y: 4, z: 6 },
      rotation: { x: expect.closeTo(0), y: expect.closeTo(90), z: expect.closeTo(0) },
    });

    // Move the position outside of the probe
    sendPositionSpy.mockImplementation(() => ({
      position: new THREE.Vector3(20, 40, 60),
      rotation: new THREE.Euler(0, THREE.MathUtils.degToRad(135), 0),
    }));
    const leaveEvent = await new Promise<CustomEvent>((resolve) => {
      element.addEventListener("positionleave", (event: CustomEvent) => {
        resolve(event);
      });
    });
    expect(leaveEvent.type).toEqual("positionleave");
  });
});
