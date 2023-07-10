import * as THREE from "three";

import { Interaction } from "../../elements";
import { IMMLScene, PromptProps } from "../../MMLScene";

export function createWrappedScene(scene: IMMLScene, container: THREE.Group): IMMLScene {
  return {
    addCollider(collider: THREE.Object3D): void {
      if (scene.addCollider) {
        scene.addCollider(collider);
      }
    },
    updateCollider(collider: THREE.Object3D): void {
      if (scene.updateCollider) {
        scene.updateCollider(collider);
      }
    },
    removeCollider(collider: THREE.Object3D): void {
      if (scene.removeCollider) {
        scene.removeCollider(collider);
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
