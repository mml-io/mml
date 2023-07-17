/**
 * @jest-environment jsdom
 */

import { AudioContext } from "standardized-audio-context-mock";
import * as THREE from "three";

import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { Model } from "../src/elements/Model";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";
import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMScene } from "../src/FullScreenMScene";

beforeAll(() => {
  (window as any).AudioContext = AudioContext;
  registerCustomElementsToWindow(window);
});

describe("m-model", () => {
  test("test attachment to scene", async () => {
    const scene = new FullScreenMScene();
    const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;
    sceneAttachment.init(scene, "ws://localhost:8080");
    document.body.append(sceneAttachment);
    const element = document.createElement("m-model") as Model;
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
    const mockGLTFLoad = jest.spyOn(Model.prototype, "asyncLoadSourceAsset").mockResolvedValue({
      animations: [],
      scene: testNode,
      scenes: [],
      cameras: [],
      asset: {},
      userData: null,
    });

    element.setAttribute("src", "some_asset_path");
    expect(mockGLTFLoad).toBeCalledTimes(1);
    expect((element as any).latestSrcModelPromise).toBeTruthy();
    await (element as any).latestSrcModelPromise;
    expect(element.getModel().name).toBe(testNode.name);

    mockGLTFLoad.mockRestore();
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-model", Model);
    expect(schema.name).toEqual(Model.tagName);
  });
});
