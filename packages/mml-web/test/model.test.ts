import { jest } from "@jest/globals";
import * as THREE from "three";

import { Model } from "../src/elements/Model";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";
import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMMLScene } from "../src/FullScreenMMLScene";
import { createTestScene } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-model", () => {
  test("test attachment to scene", async () => {
    const scene = new FullScreenMMLScene();
    const remoteDocument = document.createElement("m-remote-document") as RemoteDocument;
    remoteDocument.init(scene, "ws://localhost:8080");
    document.body.append(remoteDocument);
    const element = document.createElement("m-model") as Model;
    remoteDocument.append(element);
    expect(scene.getThreeScene()).toMatchObject({
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
    // Setting scale attribute - should affect the container of the element, but not the model root itself
    expect(element.getContainer().scale.x).toBe(1);
    element.setAttribute("sx", "5");
    expect(element.getContainer().scale.x).toBe(5);

    const testNode = new THREE.Group();
    testNode.name = "MY_LOADED_ASSET";

    // mock the loader to return a specific THREE node
    const mockGLTFLoad = jest.spyOn(Model.prototype, "asyncLoadSourceAsset").mockResolvedValue({
      animations: [],
      group: testNode,
    });

    element.setAttribute("src", "some_asset_path");
    expect(mockGLTFLoad).toBeCalledTimes(1);
    expect((element as any).latestSrcModelPromise).toBeTruthy();
    await (element as any).latestSrcModelPromise;
    expect(element.getModel()!.name).toBe(testNode.name);

    mockGLTFLoad.mockRestore();
  });

  test("geometries are disposed of when elements are removed", async () => {
    const { scene, remoteDocument } = createTestScene();
    const element = document.createElement("m-model") as Model;

    // mock the loader to return a specific THREE node
    const asyncLoadSpy = jest.spyOn(element, "asyncLoadSourceAsset");

    const firstBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const firstMaterial = new THREE.MeshStandardMaterial();
    const firstMesh = new THREE.Mesh(firstBoxGeometry, firstMaterial);
    const firstGroup = new THREE.Group();
    firstGroup.add(firstMesh);
    const firstGeometryDisposeSpy = jest.spyOn(firstBoxGeometry, "dispose");
    const firstMaterialDisposeSpy = jest.spyOn(firstMaterial, "dispose");

    asyncLoadSpy.mockResolvedValue({
      animations: [],
      group: firstGroup,
    });

    // Setting the attribute should not cause the model to be loaded as the element is not connected
    element.setAttribute("src", "some_asset_path");

    expect(asyncLoadSpy).toBeCalledTimes(0);
    expect(firstGeometryDisposeSpy).toBeCalledTimes(0);
    expect(firstMaterialDisposeSpy).toBeCalledTimes(0);

    // Appending the element to the document should cause the model to be loaded
    remoteDocument.append(element);

    expect(asyncLoadSpy).toBeCalledTimes(1);
    expect(firstGeometryDisposeSpy).toBeCalledTimes(0);
    expect(firstMaterialDisposeSpy).toBeCalledTimes(0);

    expect((element as any).latestSrcModelPromise).toBeTruthy();
    await (element as any).latestSrcModelPromise;

    expect(scene.getThreeScene().children[0].children[0].children[0].children[0].children[0]).toBe(
      firstMesh,
    );

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

    asyncLoadSpy.mockResolvedValueOnce({
      animations: [],
      group: secondGroup,
    });

    // Re-appending the element should cause the model to be re-loaded
    remoteDocument.append(element);

    expect((element as any).latestSrcModelPromise).toBeTruthy();
    await (element as any).latestSrcModelPromise;

    expect(scene.getThreeScene().children[0].children[0].children[0].children[0].children[0]).toBe(
      secondMesh,
    );
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-model", Model);
    expect(schema.name).toEqual(Model.tagName);
  });
});
