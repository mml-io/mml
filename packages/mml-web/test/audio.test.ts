import { jest } from "@jest/globals";
import { StandaloneThreeJSAdapter } from "@mml-io/mml-web-threejs-standalone";

import { Audio, registerCustomElementsToWindow } from "../build/index";
import { createSceneAttachedElement } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-audio", () => {
  test("test attachment to scene", async () => {
    const { scene, element } = await createSceneAttachedElement<Audio>("m-audio");

    expect(
      (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene().children[0]
        .children[0].children[0],
    ).toBe(element.getContainer());
  });

  test("loading and playing audio", async () => {
    const { element } = await createSceneAttachedElement<Audio>("m-audio");

    const audioBuffer: AudioBuffer = {} as AudioBuffer;
    jest.spyOn(AudioContext.prototype, "decodeAudioData").mockImplementation(() => {
      return Promise.resolve(audioBuffer);
    });

    element.setAttribute("src", "http://example.com/some_asset_path");

    await (element as any).audioGraphics.loadedAudioState.loadedAudio.srcLoadPromise;

    expect((element as any).audioGraphics.loadedAudioState.loadedAudio.buffer).toBe(audioBuffer);
  });

  test("element observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-audio", Audio);
    expect(schema.name).toEqual(Audio.tagName);
  });
});
