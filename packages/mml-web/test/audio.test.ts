/**
 * @jest-environment jsdom
 */

import AudioContext from "./__mocks__/AudioContext";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { Audio, FullScreenMScene, registerCustomElementsToWindow, RemoteDocument } from "../src";

jest.mock("../src/utils/audio");

beforeAll(() => {
  (window as any).AudioContext = AudioContext;
  registerCustomElementsToWindow(window);
});

function setupScene() {
  const scene = new FullScreenMScene();
  const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;
  sceneAttachment.setMScene(scene);
  document.body.append(sceneAttachment);
  return { scene, sceneAttachment };
}

describe("m-audio", () => {
  test("test attachment to scene", () => {
    const { scene, sceneAttachment } = setupScene();

    const element = document.createElement("m-audio") as Audio;
    sceneAttachment.append(element);

    expect(scene.getThreeScene().children[0].children[0].children[0]).toBe(element.getContainer());
  });

  test("loading and playing audio", () => {
    const { sceneAttachment } = setupScene();

    const element = document.createElement("m-audio") as Audio;
    sceneAttachment.append(element);

    element.setAttribute("src", "http://example.com/some_asset_path");
    element.setAttribute("enabled", "true");

    expect((element as any).loadedAudioState.audioElement.src).toEqual(
      "http://example.com/some_asset_path",
    );
  });

  test("element observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-audio", Audio);
    expect(schema.name).toEqual(Audio.tagName);
  });
});
