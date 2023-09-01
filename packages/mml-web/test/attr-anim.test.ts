import { jest } from "@jest/globals";

import { createSceneAttachedElement, createTestScene } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { Cube } from "../src";
import { AttributeAnimation } from "../src/elements/AttributeAnimation";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-attr-anim", () => {
  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-attr-anim", AttributeAnimation);
    expect(schema.name).toEqual(AttributeAnimation.tagName);
  });

  test("test attachment to scene", () => {
    const { scene, element } = createSceneAttachedElement<AttributeAnimation>("m-attr-anim");
    expect(
      scene.getThreeScene().children[0 /* root container */].children[0 /* attachment container */]
        .children[0 /* element container */],
    ).toBe(element.getContainer());
  });

  test("animates parent element attribute - add and remove", () => {
    const { sceneAttachment } = createTestScene();
    const cube = document.createElement("m-cube") as Cube;
    cube.setAttribute("x", "0");
    cube.setAttribute("y", "2");
    sceneAttachment.overrideDocumentTime(0);

    const transformableAttributeChangedValueSpy = jest.spyOn(
      cube as any,
      "transformableAttributeChangedValue",
    );
    sceneAttachment.append(cube);
    expect(transformableAttributeChangedValueSpy).toHaveBeenCalledTimes(0);
    cube.setAttribute("x", "1");
    expect(transformableAttributeChangedValueSpy).toHaveBeenCalledTimes(1);

    expect(cube.getContainer().position.x).toEqual(1);
    expect(cube.getContainer().position.y).toEqual(2);

    const attrAnim = document.createElement("m-attr-anim") as AttributeAnimation;
    attrAnim.setAttribute("attr", "x");
    attrAnim.setAttribute("start", "10");
    attrAnim.setAttribute("end", "20");
    attrAnim.setAttribute("loop", "false");
    attrAnim.setAttribute("duration", "1000");
    cube.append(attrAnim);

    // Halfway through the animation
    sceneAttachment.overrideDocumentTime(500);
    sceneAttachment.tick();
    expect(cube.getContainer().position.x).toEqual(15);
    expect(cube.getContainer().position.y).toEqual(2);
    expect(transformableAttributeChangedValueSpy).toHaveBeenCalledTimes(2);

    // Animation finishes
    sceneAttachment.overrideDocumentTime(1000);
    sceneAttachment.tick();
    expect(cube.getContainer().position.x).toEqual(20);
    expect(cube.getContainer().position.y).toEqual(2);
    expect(transformableAttributeChangedValueSpy).toHaveBeenCalledTimes(3);

    // Animation remains finished - the value should not be repeatedly set
    sceneAttachment.overrideDocumentTime(1500);
    sceneAttachment.tick();
    expect(cube.getContainer().position.x).toEqual(20);
    expect(cube.getContainer().position.y).toEqual(2);
    expect(transformableAttributeChangedValueSpy).toHaveBeenCalledTimes(3);

    // Removing the animation element should reset the value of the parent to the attribute value
    attrAnim.remove();
    sceneAttachment.tick();
    expect(cube.getContainer().position.x).toEqual(1);
    expect(cube.getContainer().position.y).toEqual(2);
    expect(transformableAttributeChangedValueSpy).toHaveBeenCalledTimes(4);
  });
});
