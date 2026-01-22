import * as THREE from "three";
import { vi } from "vitest";

import { MElement, MMLCollisionTrigger } from "../build/index";
import { Cube } from "../build/index";
import { registerCustomElementsToWindow } from "../build/index";
import { createTestScene } from "./scene-test-utils";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("MMLCollisionTrigger", () => {
  test("cube - send start, move, end", async () => {
    const { scene, remoteDocument } = await createTestScene();
    const mockPerformanceNow = vi.fn();
    window.performance.now = mockPerformanceNow as () => DOMHighResTimeStamp;
    mockPerformanceNow.mockReturnValue(1000);

    const mmlCollisionTrigger = MMLCollisionTrigger.init();

    vi.spyOn(scene, "addCollider").mockImplementation((collider: unknown, element: MElement) => {
      mmlCollisionTrigger.addCollider(collider, element);
    });

    vi.spyOn(scene, "removeCollider").mockImplementation((collider: unknown) => {
      mmlCollisionTrigger.removeCollider(collider);
    });

    const element = document.createElement("m-cube") as Cube;
    remoteDocument.append(element);
    element.setAttribute("collision-interval", "100");

    const enterEventFn = vi.fn();
    element.addEventListener("collisionstart", (event: CustomEvent) => {
      enterEventFn(event);
    });
    const moveEventFn = vi.fn();
    element.addEventListener("collisionmove", (event: CustomEvent) => {
      moveEventFn(event);
    });
    const endEventFn = vi.fn();
    element.addEventListener("collisionend", (event: CustomEvent) => {
      endEventFn(event);
    });

    const cubeMesh = (element.getContainer() as THREE.Object3D).children[0];

    mmlCollisionTrigger.setCurrentCollisions(
      new Map([
        [
          cubeMesh,
          {
            position: new THREE.Vector3(1, 2, 3),
          },
        ],
      ]),
    );
    expect(enterEventFn).toHaveBeenCalledTimes(1);
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
          cubeMesh,
          {
            position: new THREE.Vector3(2, 4, 6),
          },
        ],
      ]),
    );
    expect(moveEventFn).toHaveBeenCalledTimes(1);
    const moveEvent = moveEventFn.mock.calls[0][0] as CustomEvent;
    expect(moveEvent.type).toEqual("collisionmove");
    expect(moveEvent.detail).toEqual({
      position: { x: 2, y: 4, z: 6 },
    });

    mmlCollisionTrigger.setCurrentCollisions(new Map());

    expect(endEventFn).toHaveBeenCalledTimes(1);
    const endEvent = endEventFn.mock.calls[0][0] as CustomEvent;
    expect(endEvent.type).toEqual("collisionend");
  });
});
