import { jest } from "@jest/globals";
import * as THREE from "three";

import { createSceneAttachedElement } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { ChatProbe } from "../src/elements/ChatProbe";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-chat-probe", () => {
  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-chat-probe", ChatProbe);
    expect(schema.name).toEqual(ChatProbe.tagName);
  });

  test("test attachment to scene", () => {
    const { scene, element } = createSceneAttachedElement<ChatProbe>("m-chat-probe");
    expect(
      scene.getThreeScene().children[0 /* root container */].children[0 /* attachment container */]
        .children[0 /* element container */],
    ).toBe(element.getContainer());
  });

  test("chat-probe - send message", () => {
    const { element, scene } = createSceneAttachedElement<ChatProbe>("m-chat-probe");
    element.setAttribute("range", "10");
    element.setAttribute("interval", "100");

    const sendPositionSpy = jest.spyOn(scene, "getUserPositionAndRotation");
    sendPositionSpy.mockImplementation(() => ({
      position: new THREE.Vector3(1, 2, 3),
      rotation: new THREE.Euler(0, THREE.MathUtils.degToRad(45), 0),
    }));

    const chatListener = jest.fn();
    element.addEventListener("chat", (event: CustomEvent) => {
      expect(event.type).toEqual("chat");
      chatListener(event.detail.message);
    });
    element.trigger("First");
    expect(chatListener).toHaveBeenCalledTimes(1);
    expect(chatListener).toHaveBeenNthCalledWith(1, "First");

    // Set the position to be out of range
    element.setAttribute("range", "1");
    element.trigger("Second");
    // Should not have been called
    expect(chatListener).toHaveBeenCalledTimes(1);

    // Set the position to be back in range
    element.setAttribute("range", "5");
    element.trigger("Third");
    // Should not have been called
    expect(chatListener).toHaveBeenCalledTimes(2);
    expect(chatListener).toHaveBeenNthCalledWith(2, "Third");
  });
});
