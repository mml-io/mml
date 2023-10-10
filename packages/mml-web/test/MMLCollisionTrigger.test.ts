import { jest } from "@jest/globals";
import * as THREE from "three";

import { createTestScene } from "./scene-test-utils";
import { MElement, MMLCollisionTrigger } from "../src";
import { Cube } from "../src/elements/Cube";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("MMLCollisionTrigger", () => {
  test("cube - send start, move, end", () => {
    const { scene, remoteDocument } = createTestScene();
    const mockPerformanceNow = jest.fn();
    window.performance.now = mockPerformanceNow as () => DOMHighResTimeStamp;
    mockPerformanceNow.mockReturnValue(1000);

    const mmlCollisionTrigger = MMLCollisionTrigger.init();

    jest
      .spyOn(scene, "addCollider")
      .mockImplementation((collider: THREE.Object3D, element: MElement) => {
        mmlCollisionTrigger.addCollider(collider, element);
      });

    jest.spyOn(scene, "removeCollider").mockImplementation((collider: THREE.Object3D) => {
      mmlCollisionTrigger.removeCollider(collider);
    });

    const element = document.createElement("m-cube") as Cube;
    remoteDocument.append(element);
    element.setAttribute("collision-interval", "100");

    const enterEventFn = jest.fn();
    element.addEventListener("collisionstart", (event: CustomEvent) => {
      enterEventFn(event);
    });
    const moveEventFn = jest.fn();
    element.addEventListener("collisionmove", (event: CustomEvent) => {
      moveEventFn(event);
    });
    const endEventFn = jest.fn();
    element.addEventListener("collisionend", (event: CustomEvent) => {
      endEventFn(event);
    });

    mmlCollisionTrigger.setCurrentCollisions(
      new Map([
        [
          element.getCube()!,
          {
            position: new THREE.Vector3(1, 2, 3),
          },
        ],
      ]),
    );
    expect(enterEventFn).toBeCalledTimes(1);
    const enterEvent = enterEventFn.mock.calls[0][0] as CustomEvent;
    expect(enterEvent.type).toEqual("collisionstart");
    expect(enterEvent.detail).toEqual({
      position: { x: 1, y: 2, z: 3 },
    });

    // Progress the time so that the update interval has passed and a move event should be sent
    mockPerformanceNow.mockReturnValue(1500);

    mmlCollisionTrigger.setCurrentCollisions(
      new Map([
        [
          element.getCube()!,
          {
            position: new THREE.Vector3(2, 4, 6),
          },
        ],
      ]),
    );
    expect(moveEventFn).toBeCalledTimes(1);
    const moveEvent = moveEventFn.mock.calls[0][0] as CustomEvent;
    expect(moveEvent.type).toEqual("collisionmove");
    expect(moveEvent.detail).toEqual({
      position: { x: 2, y: 4, z: 6 },
    });

    mmlCollisionTrigger.setCurrentCollisions(new Map());

    expect(endEventFn).toBeCalledTimes(1);
    const endEvent = endEventFn.mock.calls[0][0] as CustomEvent;
    expect(endEvent.type).toEqual("collisionend");
  });
});
