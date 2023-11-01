import { jest } from "@jest/globals";
import * as THREE from "three";

import { createSceneAttachedElement, createTestScene } from "./scene-test-utils";
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

  test("chatProbe - update", () => {
    const { scene, remoteDocument } = createTestScene();
    const element = document.createElement("m-chat-probe") as ChatProbe;
    expect(Array.from((scene as any).chatProbes)).toEqual([]);
    const addChatProbeSpy = jest.spyOn(scene, "addChatProbe");
    const updateChatProbeSpy = jest.spyOn(scene, "updateChatProbe");
    remoteDocument.append(element);

    expect(addChatProbeSpy).toHaveBeenCalledTimes(1);
    expect(addChatProbeSpy).toHaveBeenCalledWith(element);
    expect(updateChatProbeSpy).toHaveBeenCalledTimes(0);
    expect(Array.from((scene as any).chatProbes)).toEqual([element]);

    element.setAttribute("y", "1");
    expect(updateChatProbeSpy).toHaveBeenCalledTimes(1);
    expect(updateChatProbeSpy).toHaveBeenCalledWith(element);
    expect(addChatProbeSpy).toHaveBeenCalledTimes(1);

    expect(Array.from((scene as any).chatProbes)).toEqual([element]);
  });

  test("chatProbe - update from ancestor", () => {
    const { element, scene } = createSceneAttachedElement<ChatProbe>("m-group");

    const addChatProbeSpy = jest.spyOn(scene, "addChatProbe");
    const updateChatProbeSpy = jest.spyOn(scene, "updateChatProbe");

    const innerGroup = document.createElement("m-group");
    element.appendChild(innerGroup);

    const mChatProbe = document.createElement("m-chat-probe") as ChatProbe;
    mChatProbe.setAttribute("x", "1");
    mChatProbe.setAttribute("y", "2");
    mChatProbe.setAttribute("z", "3");
    innerGroup.appendChild(mChatProbe);

    expect(addChatProbeSpy).toHaveBeenCalledTimes(1);
    expect(addChatProbeSpy).toHaveBeenCalledWith(mChatProbe);
    expect(updateChatProbeSpy).toHaveBeenCalledTimes(0);
    expect(Array.from((scene as any).chatProbes)).toEqual([mChatProbe]);

    // y should be increased by one due to the parent group - should now be 3
    element.setAttribute("y", "1");
    expect(updateChatProbeSpy).toHaveBeenCalledTimes(1);
    expect(updateChatProbeSpy).toHaveBeenCalledWith(mChatProbe);
    expect(addChatProbeSpy).toHaveBeenCalledTimes(1);
    const worldPos = new THREE.Vector3();
    mChatProbe.getContainer().getWorldPosition(worldPos);
    expect(worldPos).toMatchObject({ x: 1, y: 3, z: 3 });

    innerGroup.setAttribute("z", "1");
    expect(updateChatProbeSpy).toHaveBeenCalledTimes(2);
    expect(updateChatProbeSpy).toHaveBeenNthCalledWith(2, mChatProbe);
    expect(addChatProbeSpy).toHaveBeenCalledTimes(1);
    mChatProbe.getContainer().getWorldPosition(worldPos);
    // z should be increased by one due to the parent group - should now be 4
    expect(worldPos).toMatchObject({ x: 1, y: 3, z: 4 });

    expect(Array.from((scene as any).chatProbes)).toEqual([mChatProbe]);
  });
});
