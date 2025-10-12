import { jest } from "@jest/globals";
import { ThreeJSResourceManager } from "@mml-io/mml-web-threejs";
import { StandaloneThreeJSAdapter } from "@mml-io/mml-web-threejs-standalone";
import * as THREE from "three";

import { Model } from "../build/index";
import { registerCustomElementsToWindow } from "../build/index";
import { createSceneAttachedElement, createTestScene } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-model", () => {
  test("test attachment to scene", async () => {
    const { scene, element } = await createSceneAttachedElement<Model>(
      "m-model",
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
    const loadModelSpy = jest.spyOn(rm, "loadModel").mockImplementation(() => {
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
    expect(loadModelSpy).toBeCalledTimes(1);

    const modelContainer = element.getContainer() as THREE.Object3D;
    const loadedModel = modelContainer.children[0];
    expect(loadedModel.name).toBe(testNode.name);
    loadModelSpy.mockRestore();
  });

  test("geometries are disposed of when elements are removed", async () => {
    const { scene, remoteDocument } = await createTestScene();
    const element = document.createElement("m-model") as Model;

    const firstBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const firstMaterial = new THREE.MeshStandardMaterial();
    const firstMesh = new THREE.Mesh(firstBoxGeometry, firstMaterial);
    const firstGroup = new THREE.Group();
    firstGroup.add(firstMesh);
    const firstGeometryDisposeSpy = jest.spyOn(firstBoxGeometry, "dispose");
    const firstMaterialDisposeSpy = jest.spyOn(firstMaterial, "dispose");

    const ga = scene.getGraphicsAdapter() as StandaloneThreeJSAdapter;
    const rm = ga.getResourceManager() as ThreeJSResourceManager;
    const loadModelSpy = jest.spyOn(rm, "loadModel");
    loadModelSpy.mockImplementation(() => {
      const handle = {
        onProgress: () => {},
        onLoad: (cb: (result: { animations: any[]; group: THREE.Group } | Error) => void) => {
          cb({ animations: [], group: firstGroup });
        },
        getResult: () => null,
        dispose: () => {},
      };
      return handle as any;
    });

    // Setting the attribute should not cause the model to be loaded as the element is not connected
    element.setAttribute("src", "some_asset_path");

    expect(loadModelSpy).toBeCalledTimes(0);
    expect(firstGeometryDisposeSpy).toBeCalledTimes(0);
    expect(firstMaterialDisposeSpy).toBeCalledTimes(0);

    // Appending the element to the document should cause the model to be loaded
    remoteDocument.append(element);

    expect(loadModelSpy).toBeCalledTimes(1);
    expect(firstGeometryDisposeSpy).toBeCalledTimes(0);
    expect(firstMaterialDisposeSpy).toBeCalledTimes(0);

    // loaded synchronously by our mock

    expect(
      (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene().children[0]
        .children[0].children[0].children[0].children[0],
    ).toBe(firstMesh);

    // Removing the element should cause the model to be removed from the scene and disposed of
    element.remove();

    // The geometry and material should be disposed of when the element is removed to avoid leaks
    expect(firstGeometryDisposeSpy).toBeCalledTimes(1);
    expect(firstMaterialDisposeSpy).toBeCalledTimes(1);

    const secondBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const secondMaterial = new THREE.MeshStandardMaterial();
    const secondMesh = new THREE.Mesh(secondBoxGeometry, secondMaterial);
    const secondGroup = new THREE.Group();
    secondGroup.add(secondMesh);

    loadModelSpy.mockImplementationOnce(() => {
      const handle = {
        onProgress: () => {},
        onLoad: (cb: (result: { animations: any[]; group: THREE.Group } | Error) => void) => {
          cb({ animations: [], group: secondGroup });
        },
        getResult: () => null,
        dispose: () => {},
      };
      return handle as any;
    });

    // Re-appending the element should cause the model to be re-loaded
    remoteDocument.append(element);

    // loaded synchronously by our mock

    expect(
      (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene().children[0]
        .children[0].children[0].children[0].children[0],
    ).toBe(secondMesh);
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-model", Model);
    expect(schema.name).toEqual(Model.tagName);
  });
});
