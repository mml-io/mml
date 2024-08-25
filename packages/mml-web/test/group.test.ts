import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { Group } from "../src/elements/Group";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";
import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMMLScene } from "../src/FullScreenMMLScene";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-group", () => {
  test("test attachment to scene", () => {
    const scene = new FullScreenMMLScene();
    const remoteDocument = document.createElement("m-remote-document") as RemoteDocument;
    remoteDocument.init(scene, "ws://localhost:8080");
    document.body.append(remoteDocument);

    const element = document.createElement("m-group") as Group;
    remoteDocument.append(element);

    expect(scene.getThreeScene().children[0].children[0].children[0]).toBe(element.getContainer());

    // Setting scale attribute - should affect the container of the element, but not the mesh itself
    expect(element.getContainer().scale.x).toBe(1);
    element.setAttribute("sx", "5");
    expect(element.getContainer().scale.x).toBe(5);
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-group", Group);
    expect(schema.name).toEqual(Group.tagName);
  });
});
