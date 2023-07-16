import { FullScreenMScene, RemoteDocument } from "../src";

export function createSceneAttachedElement<T extends HTMLElement>(
  elementTag: string,
  documentAddress?: string,
): { scene: FullScreenMScene; sceneAttachment: RemoteDocument; element: T } {
  const { scene, sceneAttachment } = createTestScene(documentAddress);

  const element = document.createElement(elementTag) as T;
  sceneAttachment.append(element);
  return { scene, sceneAttachment, element };
}

export function createTestScene(documentAddress?: string): {
  scene: FullScreenMScene;
  sceneAttachment: RemoteDocument;
} {
  const scene = new FullScreenMScene();
  const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;
  sceneAttachment.init(scene, documentAddress || "ws://localhost:8080");
  document.body.append(sceneAttachment);
  return { scene, sceneAttachment };
}
