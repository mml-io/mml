import { GraphicsAdapter } from "@mml-io/mml-web";
import * as THREE from "three";

import { ThreeJSResourceManager } from "./resources/ThreeJSResourceManager";

export type ThreeJSGraphicsAdapter = GraphicsAdapter<
  THREE.Object3D,
  THREE.Object3D,
  THREE.Object3D
> & {
  getResourceManager(): ThreeJSResourceManager;
  getThreeScene(): THREE.Scene;
  getCamera(): THREE.Camera;
  getAudioListener(): THREE.AudioListener;
};
