import { GraphicsAdapter } from "mml-web";
import * as THREE from "three";

export type ThreeJSGraphicsAdapter = GraphicsAdapter<
  THREE.Object3D,
  THREE.Object3D,
  THREE.Object3D
> & {
  getThreeScene(): THREE.Scene;
  getCamera(): THREE.Camera;
  getAudioListener(): THREE.AudioListener;
};
