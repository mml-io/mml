import { StandaloneThreeJSAdapter } from "@mml-io/mml-web-threejs-standalone";
import { vi } from "vitest";

import { Audio } from "../build/index";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { createModeContext, ModeContext } from "./test-mode-utils";

describe.each(["virtual", "dom"] as const)("m-audio [%s mode]", (mode) => {
  let ctx: ModeContext;
  beforeAll(async () => {
    ctx = await createModeContext(mode);
  });
  afterAll(() => {
    ctx.cleanup();
  });

  test("test attachment to scene", async () => {
    const { scene, element } = await ctx.createSceneAttachedElement<Audio>("m-audio");

    expect(
      (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene().children[0]
        .children[0].children[0],
    ).toBe(element.getContainer());
  });

  test("loading and playing audio", async () => {
    const { element } = await ctx.createSceneAttachedElement<Audio>("m-audio");

    const audioBuffer: AudioBuffer = {} as AudioBuffer;
    vi.spyOn(AudioContext.prototype, "decodeAudioData").mockImplementation(() => {
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
