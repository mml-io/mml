import { jest } from "@jest/globals";
import { StandaloneThreeJSAdapter } from "@mml-io/mml-web-threejs-standalone";

import { EulXYZ, PositionProbe, registerCustomElementsToWindow, Vect3 } from "../build/index";
import { createSceneAttachedElement } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-position-probe", () => {
  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-position-probe", PositionProbe);
    expect(schema.name).toEqual(PositionProbe.tagName);
  });

  test("test attachment to scene", async () => {
    const { scene, element } = await createSceneAttachedElement<PositionProbe>("m-position-probe");
    expect(
      (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
        .children[0 /* root container */].children[0 /* attachment container */]
        .children[0 /* element container */],
    ).toBe(element.getContainer());
  });

  test("position-probe - send position", async () => {
    const { element, scene } = await createSceneAttachedElement<PositionProbe>("m-position-probe");
    element.setAttribute("range", "10");
    element.setAttribute("interval", "100");

    const sendPositionSpy = jest.spyOn(scene, "getUserPositionAndRotation");
    sendPositionSpy.mockImplementation(() => ({
      position: new Vect3(1, 2, 3),
      rotation: new EulXYZ(0, 45, 0),
    }));

    const enterEvent = await new Promise<CustomEvent>((resolve) => {
      element.addEventListener("positionenter", (event: CustomEvent) => {
        resolve(event);
      });
    });
    expect(enterEvent.type).toEqual("positionenter");
    expect(enterEvent.detail).toEqual({
      elementRelative: {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: expect.closeTo(0), y: expect.closeTo(45), z: expect.closeTo(0) },
      },
      documentRelative: {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: expect.closeTo(0), y: expect.closeTo(45), z: expect.closeTo(0) },
      },
    });

    // Move the position
    sendPositionSpy.mockImplementation(() => ({
      position: new Vect3(2, 4, 6),
      rotation: new EulXYZ(0, 90, 0),
    }));
    const moveEvent = await new Promise<CustomEvent>((resolve) => {
      element.addEventListener("positionmove", (event: CustomEvent) => {
        resolve(event);
      });
    });
    expect(moveEvent.type).toEqual("positionmove");
    expect(moveEvent.detail).toEqual({
      elementRelative: {
        position: { x: 2, y: 4, z: 6 },
        rotation: { x: expect.closeTo(0), y: expect.closeTo(90), z: expect.closeTo(0) },
      },
      documentRelative: {
        position: { x: 2, y: 4, z: 6 },
        rotation: { x: expect.closeTo(0), y: expect.closeTo(90), z: expect.closeTo(0) },
      },
    });

    // Move the position outside the probe range
    sendPositionSpy.mockImplementation(() => ({
      position: new Vect3(20, 40, 60),
      rotation: new EulXYZ(0, 135, 0),
    }));
    const leaveEvent = await new Promise<CustomEvent>((resolve) => {
      element.addEventListener("positionleave", (event: CustomEvent) => {
        resolve(event);
      });
    });
    expect(leaveEvent.type).toEqual("positionleave");
  });

  test("position-probe - send position - relative", async () => {
    const { element: group, scene } = await createSceneAttachedElement("m-group");

    group.setAttribute("x", "10");
    group.setAttribute("y", "20");
    group.setAttribute("z", "30");

    const element: PositionProbe = document.createElement("m-position-probe") as PositionProbe;
    element.setAttribute("range", "10");
    element.setAttribute("interval", "100");
    group.append(element);

    const sendPositionSpy = jest.spyOn(scene, "getUserPositionAndRotation");
    sendPositionSpy.mockImplementation(() => ({
      position: new Vect3(11, 22, 33),
      rotation: new EulXYZ(0, 45, 0),
    }));

    const enterEvent = await new Promise<CustomEvent>((resolve) => {
      element.addEventListener("positionenter", (event: CustomEvent) => {
        resolve(event);
      });
    });
    expect(enterEvent.type).toEqual("positionenter");
    expect(enterEvent.detail).toEqual({
      elementRelative: {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: expect.closeTo(0), y: expect.closeTo(45), z: expect.closeTo(0) },
      },
      documentRelative: {
        position: { x: 11, y: 22, z: 33 },
        rotation: { x: expect.closeTo(0), y: expect.closeTo(45), z: expect.closeTo(0) },
      },
    });

    // Move the position
    sendPositionSpy.mockImplementation(() => ({
      position: new Vect3(12, 24, 36),
      rotation: new EulXYZ(0, 90, 0),
    }));
    const moveEvent = await new Promise<CustomEvent>((resolve) => {
      element.addEventListener("positionmove", (event: CustomEvent) => {
        resolve(event);
      });
    });
    expect(moveEvent.type).toEqual("positionmove");
    expect(moveEvent.detail).toEqual({
      elementRelative: {
        position: { x: 2, y: 4, z: 6 },
        rotation: { x: expect.closeTo(0), y: expect.closeTo(90), z: expect.closeTo(0) },
      },
      documentRelative: {
        position: { x: 12, y: 24, z: 36 },
        rotation: { x: expect.closeTo(0), y: expect.closeTo(90), z: expect.closeTo(0) },
      },
    });

    // Move the position outside the probe range
    sendPositionSpy.mockImplementation(() => ({
      position: new Vect3(20, 40, 60),
      rotation: new EulXYZ(0, 135, 0),
    }));
    const leaveEvent = await new Promise<CustomEvent>((resolve) => {
      element.addEventListener("positionleave", (event: CustomEvent) => {
        resolve(event);
      });
    });
    expect(leaveEvent.type).toEqual("positionleave");
  });
});
