import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { Link } from "../src/elements/Link";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";
import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMMLScene } from "../src/FullScreenMMLScene";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-link", () => {
  test("test attachment to scene", () => {
    const scene = new FullScreenMMLScene();
    const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;
    sceneAttachment.init(scene, "ws://localhost:8080");
    document.body.append(sceneAttachment);

    const element = document.createElement("m-link") as Link;
    sceneAttachment.append(element);

    expect(scene.getThreeScene().children[0].children[0].children[0]).toBe(element.getContainer());
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-link", Link);
    expect(schema.name).toEqual(Link.tagName);
  });
});
