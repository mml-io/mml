import { ThreeJSResourceManager } from "@mml-io/mml-web-threejs";
import { StandaloneThreeJSAdapter } from "@mml-io/mml-web-threejs-standalone";
import * as THREE from "three";
import { vi } from "vitest";

import { Character } from "../build/index";
import { registerCustomElementsToWindow } from "../build/index";
import { createSceneAttachedElement } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-character", () => {
  test("test attachment to scene", async () => {
    const { scene, element } = await createSceneAttachedElement<Character>(
      "m-character",
      "ws://localhost:8080",
    );

    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    expect(element.getContainer()).toBe(container);

    expect((scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()).toMatchObject({
      // Scene
      children: [
        // Scene Root Container
        {
          children: [
            // Scene Attachment Container
            {
              children: [
                // Element Container
                {
                  // no children (as no source has been specified)
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    });

    // Setting scale attribute - should affect the container of the element, but not the mesh itself
    expect((element.getContainer() as THREE.Object3D).scale.x).toBe(1);
    element.setAttribute("sx", "5");
    expect((element.getContainer() as THREE.Object3D).scale.x).toBe(5);

    const testNode = new THREE.Group();
    testNode.name = "MY_LOADED_ASSET";

    // mock the resource manager to return a handle that immediately loads our test node
    const ga = scene.getGraphicsAdapter() as StandaloneThreeJSAdapter;
    const rm = ga.getResourceManager() as ThreeJSResourceManager;
    const loadModelSpy = vi.spyOn(rm, "loadModel").mockImplementation(() => {
      const handle = {
        onProgress: () => {},
        onLoad: (cb: (result: { animations: any[]; group: THREE.Group } | Error) => void) => {
          cb({ animations: [], group: testNode });
        },
        getResult: () => null,
        dispose: () => {},
      };
      return handle as any;
    });

    element.setAttribute("src", "some_asset_path");
    expect(loadModelSpy).toHaveBeenCalledTimes(1);

    const modelContainer = element.getContainer() as THREE.Object3D;
    const loadedModel = modelContainer.children[0];
    expect(loadedModel.name).toBe(testNode.name);

    loadModelSpy.mockRestore();
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-character", Character);
    expect(schema.name).toEqual(Character.tagName);
  });
});
