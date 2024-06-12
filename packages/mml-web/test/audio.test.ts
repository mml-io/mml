import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { Audio, FullScreenMMLScene, registerCustomElementsToWindow, RemoteDocument } from "../src";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

function setupScene() {
  const scene = new FullScreenMMLScene();
  const remoteDocument = document.createElement("m-remote-document") as RemoteDocument;
  remoteDocument.init(scene, "ws://localhost:8080");
  document.body.append(remoteDocument);
  return { scene, remoteDocument };
}

describe("m-audio", () => {
  test("test attachment to scene", () => {
    const { scene, remoteDocument } = setupScene();

    const element = document.createElement("m-audio") as Audio;
    remoteDocument.append(element);

    expect(scene.getThreeScene().children[0].children[0].children[0]).toBe(element.getContainer());
  });

  test("element observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-audio", Audio);
    expect(schema.name).toEqual(Audio.tagName);
  });
});
