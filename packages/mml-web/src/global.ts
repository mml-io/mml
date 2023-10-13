import { MMLDocumentTimeManager } from "./MMLDocumentTimeManager";
import { IMMLScene } from "./MMLScene";

let scene: IMMLScene | null = null;
let documentTimeManager: MMLDocumentTimeManager | null = null;

export function setGlobalMMLScene(sceneArg: IMMLScene) {
  if (scene) {
    throw new Error("GlobalMMLScene already set");
  }
  scene = sceneArg;
}

export function getGlobalMMLScene(): IMMLScene {
  if (!scene) {
    throw new Error("GlobalMMLScene not set");
  }
  return scene;
}

export function setGlobalDocumentTimeManager(documentTimeManagerArg: MMLDocumentTimeManager) {
  if (documentTimeManager) {
    throw new Error("GlobalDocumentTimeManager already set");
  }
  documentTimeManager = documentTimeManagerArg;
}

export function getGlobalDocumentTimeManager(): MMLDocumentTimeManager {
  if (!documentTimeManager) {
    throw new Error("GlobalMMLScene not set");
  }
  return documentTimeManager;
}
