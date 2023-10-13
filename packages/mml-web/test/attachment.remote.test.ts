import * as THREE from "three";

import { Cube } from "../src/elements/Cube";
import { Group } from "../src/elements/Group";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";
import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMMLScene } from "../src/FullScreenMMLScene";

describe("m-element m-remote-document attachment", () => {
  beforeAll(() => {
    registerCustomElementsToWindow(window);
  });
  test("test attachment via div", () => {
    const scene = new FullScreenMMLScene();
    const remoteDocument = document.createElement("m-remote-document") as RemoteDocument;
    remoteDocument.init(scene, "ws://localhost:8080");
    document.body.append(remoteDocument);

    const group = document.createElement("m-group") as Group;
    remoteDocument.append(group);

    const div = document.createElement("div");
    group.append(div);

    const cube = document.createElement("m-cube") as Cube;
    div.append(cube);

    // The div should be skipped in the threejs scene
    expect(group.getContainer().children[0].children[0]).toBe(cube.getCube()!);

    expect(scene.getThreeScene()).toMatchObject({
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
                      children: expect.arrayContaining([cube.getCube()]),
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(cube.getCube()!.getWorldPosition(new THREE.Vector3())).toMatchObject({
      x: 0,
      y: 0,
      z: 0,
    });

    cube.setAttribute("x", "1");
    cube.setAttribute("y", "2");
    cube.setAttribute("z", "3");

    expect(cube.getCube()!.getWorldPosition(new THREE.Vector3())).toMatchObject({
      x: 1,
      y: 2,
      z: 3,
    });

    // Move the group and the contained cube should move in world position
    group.setAttribute("x", "10");
    group.setAttribute("y", "20");
    group.setAttribute("z", "30");
    expect(cube.getCube()!.getWorldPosition(new THREE.Vector3())).toMatchObject({
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

    // The cube should now have the world position from the second group
    expect(cube.getCube()!.getWorldPosition(new THREE.Vector3())).toMatchObject({
      x: 101,
      y: 202,
      z: 303,
    });

    // Remove the div from the group and it should also remove the cube from the scene
    secondGroup.removeChild(div);
    expect(cube.getContainer().parent).toBeNull();
  });
});
