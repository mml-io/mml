import { jest } from "@jest/globals";
import * as THREE from "three";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";

import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { Character } from "../src/elements/Character";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";
import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMMLScene } from "../src/FullScreenMMLScene";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-character", () => {
  test("attachment to scene", async () => {
    const scene = new FullScreenMMLScene();
    const remoteDocument = document.createElement("m-remote-document") as RemoteDocument;
    remoteDocument.init(scene, "ws://localhost:8080");
    document.body.append(remoteDocument);
    const element = document.createElement("m-character") as Character;
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
    const mockGLTFLoad = jest
      .spyOn(Character.prototype, "asyncLoadSourceAsset")
      .mockImplementation(() => {
        return Promise.resolve({
          animations: [],
          scene: testNode,
          scenes: [],
          cameras: [],
          asset: {},
          userData: {},
          parser: {} as any,
        });
      });

    element.setAttribute("src", "some_asset_path");
    expect(mockGLTFLoad).toBeCalledTimes(1);
    const loadModelPromise: Promise<GLTF> = (element as any).latestSrcModelPromise;
    expect(loadModelPromise).toBeTruthy();
    await loadModelPromise;
    expect(element.getCharacter()!.name).toBe(testNode.name);

    mockGLTFLoad.mockRestore();
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-character", Character);
    expect(schema.name).toEqual(Character.tagName);
  });
});
