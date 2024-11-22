import { StandaloneThreeJSAdapter } from "@mml-io/mml-web-threejs-standalone";
import * as THREE from "three";

import { Cube } from "../build/index";
import { Group } from "../build/index";
import { registerCustomElementsToWindow } from "../build/index";
import { createTestScene } from "./scene-test-utils";

describe("m-element m-remote-document attachment", () => {
  beforeAll(() => {
    registerCustomElementsToWindow(window);
  });

  test("test attachment via div", async () => {
    const { scene, remoteDocument } = await createTestScene();

    const group = document.createElement("m-group") as Group;
    remoteDocument.append(group);

    const div = document.createElement("div");
    group.append(div);

    const cube = document.createElement("m-cube") as Cube;
    div.append(cube);

    const groupContainer = group.getContainer() as THREE.Object3D;
    let cubeContainer = cube.getContainer() as THREE.Object3D;
    let cubeMesh = cubeContainer.children[0];

    // The div should be skipped in the threejs scene
    expect(groupContainer.children[0].children[0]).toBe(cubeMesh);

    expect((scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()).toMatchObject({
      // Scene
      children: [
        // Scene Root Container
        {
          children: [
            // Scene Attachment Container
            {
              children: [
                // Group Container
                {
                  // Div doesn't affect hierarchy
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
        },
      ],
    });

    expect(cubeMesh.getWorldPosition(new THREE.Vector3())).toMatchObject({
      x: 0,
      y: 0,
      z: 0,
    });

    cube.setAttribute("x", "1");
    cube.setAttribute("y", "2");
    cube.setAttribute("z", "3");

    expect(cubeMesh.getWorldPosition(new THREE.Vector3())).toMatchObject({
      x: 1,
      y: 2,
      z: 3,
    });

    // Move the group and the contained cube should move in world position
    group.setAttribute("x", "10");
    group.setAttribute("y", "20");
    group.setAttribute("z", "30");
    expect(cubeMesh.getWorldPosition(new THREE.Vector3())).toMatchObject({
      x: 11,
      y: 22,
      z: 33,
    });

    // Create a second group that has a different position and move the div to it. The cube should move with the div
    const secondGroup = document.createElement("m-group") as Group;
    remoteDocument.append(secondGroup);
    secondGroup.setAttribute("x", "100");
    secondGroup.setAttribute("y", "200");
    secondGroup.setAttribute("z", "300");
    secondGroup.append(div);

    // Get new references as the instances have been removed and recreated
    cubeContainer = cube.getContainer() as THREE.Object3D;
    cubeMesh = cubeContainer.children[0];

    // The cube should now have the world position from the second group
    expect(cubeMesh.getWorldPosition(new THREE.Vector3())).toMatchObject({
      x: 101,
      y: 202,
      z: 303,
    });

    // Remove the div from the group and it should also remove the cube from the scene
    secondGroup.removeChild(div);
    expect(cubeContainer.parent).toBeNull();
  });
});
