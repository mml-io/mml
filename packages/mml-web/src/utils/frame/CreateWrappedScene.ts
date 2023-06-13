import * as THREE from "three";

import { Interaction } from "../../elements";
import { MixerContext } from "../../html/HTMLMixer";
import { IMMLScene, PromptProps } from "../../MMLScene";

export function createWrappedScene(scene: IMMLScene, container: THREE.Group): IMMLScene {
  // Reused variables for calculating frame-relative user position
  const sceneMatrix = new THREE.Matrix4();
  const locationMatrix = new THREE.Matrix4();
  const posVector = new THREE.Vector3();
  const rotEuler = new THREE.Euler();
  const rotQuaternion = new THREE.Quaternion();
  const scaleVector = new THREE.Vector3();

  return {
    addCollider(collider: THREE.Object3D): void {
      return scene.addCollider(collider);
    },
    updateCollider(collider: THREE.Object3D): void {
      return scene.updateCollider(collider);
    },
    removeCollider(collider: THREE.Object3D): void {
      return scene.removeCollider(collider);
    },
    addInteraction(interaction: Interaction): void {
      return scene.addInteraction(interaction);
    },
    updateInteraction(interaction: Interaction): void {
      return scene.updateInteraction(interaction);
    },
    removeInteraction(interaction: Interaction): void {
      return scene.removeInteraction(interaction);
    },
    getAudioListener: () => {
      return scene.getAudioListener();
    },
    getRenderer(): THREE.Renderer {
      return scene.getRenderer();
    },
    getCSSMixerContext(): MixerContext {
      return scene.getCSSMixerContext();
    },
    getThreeScene(): THREE.Scene {
      return scene.getThreeScene();
    },
    getCamera(): THREE.Camera {
      return scene.getCamera();
    },
    setControlsEnabled(enabled: boolean) {
      scene.setControlsEnabled(enabled);
    },
    prompt(promptProps: PromptProps, callback: (result: string | null) => void) {
      scene.prompt(promptProps, callback);
    },
    getRootContainer: () => {
      return container;
    },
    getUserPosition: () => {
      // Determine the position relative to the document
      const { location, orientation } = scene.getUserPosition();

      const { x, y, z } = location;
      const { x: ox, y: oy, z: oz } = orientation;

      sceneMatrix.copy(scene.getRootContainer().matrixWorld);
      sceneMatrix.invert().multiply(this.container.matrixWorld).invert();

      posVector.set(x, y, z);
      rotEuler.set(ox, oy, oz);
      rotQuaternion.setFromEuler(rotEuler);
      scaleVector.set(1, 1, 1);

      locationMatrix.compose(posVector, rotQuaternion, scaleVector);
      locationMatrix.premultiply(sceneMatrix);
      locationMatrix.decompose(posVector, rotQuaternion, scaleVector);
      rotEuler.setFromQuaternion(rotQuaternion);

      return {
        location: {
          x: posVector.x,
          y: posVector.y,
          z: posVector.z,
        },
        orientation: {
          x: rotEuler.x,
          y: rotEuler.y,
          z: rotEuler.z,
        },
      };
    },
  };
}
