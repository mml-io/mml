/**
 * @jest-environment jsdom
 */

import { AudioContext } from "standardized-audio-context-mock";
import * as THREE from "three";

import { configureWindowForMML, getGlobalMScene } from "../src";
import { Cube } from "../src/elements/Cube";
import { Group } from "../src/elements/Group";

describe("m-element direct page attachment", () => {
  beforeAll(() => {
    (window as any).AudioContext = AudioContext;
    configureWindowForMML(window);
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });
  test("test attachment via div", () => {
    const group = document.createElement("m-group") as Group;
    document.body.append(group);

    const div = document.createElement("div");
    group.append(div);

    const cube = document.createElement("m-cube") as Cube;
    div.append(cube);

    // The div should be skipped in the threejs scene
    expect(group.getContainer().children[0].children[0]).toBe(cube.getCube());

    expect(cube.getCube().getWorldPosition(new THREE.Vector3())).toMatchObject({
      x: 0,
      y: 0,
      z: 0,
    });

    cube.setAttribute("x", "1");
    cube.setAttribute("y", "2");
    cube.setAttribute("z", "3");

    expect(cube.getCube().getWorldPosition(new THREE.Vector3())).toMatchObject({
      x: 1,
      y: 2,
      z: 3,
    });

    // Move the group and the contained cube should move in world position
    group.setAttribute("x", "10");
    group.setAttribute("y", "20");
    group.setAttribute("z", "30");
    expect(cube.getCube().getWorldPosition(new THREE.Vector3())).toMatchObject({
      x: 11,
      y: 22,
      z: 33,
    });

    // Create a second group that has a different position and move the div to it. The cube should move with the div
    const secondGroup = document.createElement("m-group") as Group;
    document.body.append(secondGroup);
    secondGroup.setAttribute("x", "100");
    secondGroup.setAttribute("y", "200");
    secondGroup.setAttribute("z", "300");
    secondGroup.append(div);

    // The cube should now have the world position from the second group
    expect(cube.getCube().getWorldPosition(new THREE.Vector3())).toMatchObject({
      x: 101,
      y: 202,
      z: 303,
    });

    // Remove the div from the group and it should also remove the cube from the scene
    secondGroup.removeChild(div);
    expect(cube.getContainer().parent).toBeNull();
  });
});
