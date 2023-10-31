import * as THREE from "three";

import { Interaction, MElement } from "../../elements";
import { ChatProbe } from "../../elements/ChatProbe";
import { IMMLScene, PromptProps } from "../../MMLScene";

export function createWrappedScene(scene: IMMLScene, container: THREE.Group): IMMLScene {
  return {
    addCollider(collider: THREE.Object3D, element: MElement): void {
      if (scene.addCollider) {
        scene.addCollider(collider, element);
      }
    },
    updateCollider(collider: THREE.Object3D, element: MElement): void {
      if (scene.updateCollider) {
        scene.updateCollider(collider, element);
      }
    },
    removeCollider(collider: THREE.Object3D, element: MElement): void {
      if (scene.removeCollider) {
        scene.removeCollider(collider, element);
      }
    },
    addInteraction(interaction: Interaction): void {
      if (scene.addInteraction) {
        scene.addInteraction(interaction);
      }
    },
    updateInteraction(interaction: Interaction): void {
      if (scene.updateInteraction) {
        scene.updateInteraction(interaction);
      }
    },
    removeInteraction(interaction: Interaction): void {
      if (scene.removeInteraction) {
        scene.removeInteraction(interaction);
      }
    },
    addChatProbe(chatProbe: ChatProbe): void {
      if (scene.addChatProbe) {
        scene.addChatProbe(chatProbe);
      }
    },
    updateChatProbe(chatProbe: ChatProbe): void {
      if (scene.updateChatProbe) {
        scene.updateChatProbe(chatProbe);
      }
    },
    removeChatProbe(chatProbe: ChatProbe): void {
      if (scene.removeChatProbe) {
        scene.removeChatProbe(chatProbe);
      }
    },
    getAudioListener: () => {
      return scene.getAudioListener();
    },
    getRenderer(): THREE.Renderer {
      return scene.getRenderer();
    },
    getThreeScene(): THREE.Scene {
      return scene.getThreeScene();
    },
    getCamera(): THREE.Camera {
      return scene.getCamera();
    },
    prompt(promptProps: PromptProps, callback: (result: string | null) => void) {
      scene.prompt(promptProps, callback);
    },
    getRootContainer: () => {
      return container;
    },
    getUserPositionAndRotation: () => {
      return scene.getUserPositionAndRotation();
    },
  };
}
