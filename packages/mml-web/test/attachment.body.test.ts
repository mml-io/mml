import {
  StandaloneThreeJSAdapter,
  StandaloneThreeJSAdapterControlsType,
} from "@mml-io/mml-web-three-client";
import * as THREE from "three";

import { configureWindowForMML, Cube, getGlobalMMLScene, Group } from "../build/index";

describe("m-element direct page attachment", () => {
  beforeAll(() => {
    function getGraphicsAdapter(element: HTMLElement) {
      return StandaloneThreeJSAdapter.create(element, {
        controlsType: StandaloneThreeJSAdapterControlsType.DragFly,
      });
    }
    configureWindowForMML(window, getGraphicsAdapter);
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

    const groupContainer = group.getContainer() as THREE.Object3D;
    let cubeContainer = cube.getContainer() as THREE.Object3D;
    let cubeMesh = cubeContainer.children[0];

    // The div should be skipped in the threejs scene
    expect(groupContainer.children[0].children[0]).toBe(cubeMesh);

    const scene = (
      getGlobalMMLScene().getGraphicsAdapter() as StandaloneThreeJSAdapter
    ).getThreeScene();
    expect(scene).toMatchObject({
      // Scene
      children: [
        // Scene Root Container
        {
          children: [
            // Group Container
            {
              children: [
                // Element Container
                {
                  children: expect.arrayContaining([cubeMesh]),
                },
              ],
            },
          ],
        },
      ],
    });

    expect(cubeMesh!.getWorldPosition(new THREE.Vector3())).toMatchObject({
      x: 0,
      y: 0,
      z: 0,
    });

    cube.setAttribute("x", "1");
    cube.setAttribute("y", "2");
    cube.setAttribute("z", "3");

    expect(cubeMesh!.getWorldPosition(new THREE.Vector3())).toMatchObject({
      x: 1,
      y: 2,
      z: 3,
    });

    // Move the group and the contained cube should move in world position
    group.setAttribute("x", "10");
    group.setAttribute("y", "20");
    group.setAttribute("z", "30");
    expect(cubeMesh!.getWorldPosition(new THREE.Vector3())).toMatchObject({
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

    // Get new references as the instances have been removed and recreated
    cubeContainer = cube.getContainer() as THREE.Object3D;
    cubeMesh = cubeContainer.children[0];

    // The cube should now have the world position from the second group
    expect(cubeMesh!.getWorldPosition(new THREE.Vector3())).toMatchObject({
      x: 101,
      y: 202,
      z: 303,
    });

    // Remove the div from the group and it should also remove the cube from the scene
    secondGroup.removeChild(div);
    expect(cubeContainer.parent).toBeNull();
  });
});
