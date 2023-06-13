/**
 * @jest-environment jsdom
 */

import { AudioContext } from "standardized-audio-context-mock";
import * as THREE from "three";

import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { Character } from "../src/elements/Character";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";
import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMScene } from "../src/FullScreenMScene";
import { GLTFResult } from "../src/utils/gltf";

beforeAll(() => {
  (window as any).AudioContext = AudioContext;
  registerCustomElementsToWindow(window);
});

describe("m-character", () => {
  test("attachment to scene", async () => {
    const scene = new FullScreenMScene();
    const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;
    sceneAttachment.setMScene(scene);
    document.body.append(sceneAttachment);
    const element = document.createElement("m-character") as Character;
    sceneAttachment.append(element);
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
          userData: null,
        });
      });

    element.setAttribute("src", "some_asset_path");
    expect(mockGLTFLoad).toBeCalledTimes(1);
    const loadModelPromise: Promise<GLTFResult> = (element as any).latestSrcModelPromise;
    expect(loadModelPromise).toBeTruthy();
    await loadModelPromise;
    expect(element.getCharacter().name).toBe(testNode.name);

    mockGLTFLoad.mockRestore();
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-character", Character);
    expect(schema.name).toEqual(Character.tagName);
  });
});
