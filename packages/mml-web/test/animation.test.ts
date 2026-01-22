import { ThreeJSResourceManager } from "@mml-io/mml-web-threejs";
import { StandaloneThreeJSAdapter } from "@mml-io/mml-web-threejs-standalone";
import * as THREE from "three";
import { vi } from "vitest";

import { Animation, Model } from "../build/index";
import { registerCustomElementsToWindow } from "../build/index";
import { createTestScene } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-animation", () => {
  test("test attachment as child of m-model", async () => {
    const { remoteDocument } = await createTestScene();

    // Create a model element first
    const modelElement = document.createElement("m-model") as Model;
    const animationElement = document.createElement("m-animation") as Animation;

    // Set up spy before adding to DOM
    const addSideEffectChildSpy = vi.spyOn(modelElement, "addSideEffectChild");

    // Add the animation as a child of the model
    modelElement.appendChild(animationElement);
    remoteDocument.appendChild(modelElement);

    // The animation should have proper graphics adapter
    expect(animationElement.animationGraphics).toBeTruthy();

    // The addSideEffectChild should have been called when the animation connected
    expect(addSideEffectChildSpy).toHaveBeenCalledWith(animationElement);

    addSideEffectChildSpy.mockRestore();
  });

  test("animation attributes work correctly", async () => {
    const { remoteDocument } = await createTestScene();

    // Create model and animation
    const modelElement = document.createElement("m-model") as Model;
    const animationElement = document.createElement("m-animation") as Animation;

    modelElement.appendChild(animationElement);
    remoteDocument.appendChild(modelElement);

    // Test weight attribute
    expect(animationElement.props.weight).toBe(1); // default
    animationElement.setAttribute("weight", "0.5");
    expect(animationElement.props.weight).toBe(0.5);

    // Test speed attribute
    expect(animationElement.props.speed).toBe(1); // default
    animationElement.setAttribute("speed", "2.0");
    expect(animationElement.props.speed).toBe(2.0);

    // Test ratio attribute
    expect(animationElement.props.ratio).toBe(null); // default
    animationElement.setAttribute("ratio", "0.75");
    expect(animationElement.props.ratio).toBe(0.75);

    // Test loop attribute
    expect(animationElement.props.loop).toBe(true); // default
    animationElement.setAttribute("loop", "false");
    expect(animationElement.props.loop).toBe(false);
  });

  test("animation loading with parent model", async () => {
    const { remoteDocument } = await createTestScene();

    const modelElement = document.createElement("m-model") as Model;
    const animationElement = document.createElement("m-animation") as Animation;

    // Mock the model loader
    const testModelNode = new THREE.Group();
    testModelNode.name = "MY_LOADED_MODEL";

    const { remoteDocument: rd2 } = { remoteDocument };
    const ga = rd2.getScene().getGraphicsAdapter() as StandaloneThreeJSAdapter;
    const rm = ga.getResourceManager() as ThreeJSResourceManager;
    const mockModelLoad = vi.spyOn(rm, "loadModel").mockImplementationOnce(() => {
      const handle = {
        onProgress: () => {},
        onLoad: (cb: (result: { animations: any[]; group: THREE.Group } | Error) => void) => {
          cb({
            animations: [new THREE.AnimationClip("TestAnimation", 1.0, [])],
            group: testModelNode,
          });
        },
        getResult: () => null,
        dispose: () => {},
      };
      return handle as any;
    });

    // Mock the animation loader
    const testAnimationNode = new THREE.Group();
    testAnimationNode.name = "MY_LOADED_ANIMATION";

    // The animation now loads via resource manager too
    const mockAnimationLoad = vi.spyOn(rm, "loadModel").mockImplementationOnce(() => {
      const handle = {
        onProgress: () => {},
        onLoad: (cb: (result: { animations: any[]; group: THREE.Group } | Error) => void) => {
          cb({
            animations: [new THREE.AnimationClip("TestAnimation", 1.0, [])],
            group: testAnimationNode,
          });
        },
        getResult: () => null,
        dispose: () => {},
      };
      return handle as any;
    });

    modelElement.appendChild(animationElement);
    remoteDocument.appendChild(modelElement);

    // Set sources
    modelElement.setAttribute("src", "model_asset_path");
    animationElement.setAttribute("src", "animation_asset_path");

    // The animation test may call loadModel twice (model first, then animation),
    // so ensure our spies were each called at least once
    expect(mockModelLoad).toHaveBeenCalled();
    expect(mockAnimationLoad).toHaveBeenCalled();

    // Wait for both to load
    // Loaded synchronously by our mocks

    mockModelLoad.mockRestore();
    mockAnimationLoad.mockRestore();
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-animation", Animation);
    expect(schema.name).toEqual(Animation.tagName);
  });
});
