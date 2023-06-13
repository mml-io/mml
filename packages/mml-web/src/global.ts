import { IMMLScene } from "./MMLScene";

let scene: IMMLScene | null = null;

export function setGlobalMScene(sceneArg: IMMLScene) {
  if (scene) {
    throw new Error("Scene already set");
  }
  scene = sceneArg;
}

export function getGlobalMScene(): IMMLScene {
  if (!scene) {
    throw new Error("Scene not set");
  }
  return scene;
}
