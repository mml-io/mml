import { FullScreenMMLScene, RemoteDocument } from "../src";

export function createSceneAttachedElement<T extends HTMLElement>(
  elementTag: string,
  documentAddress?: string,
): { scene: FullScreenMMLScene; remoteDocument: RemoteDocument; element: T } {
  const { scene, remoteDocument } = createTestScene(documentAddress);

  const element = document.createElement(elementTag) as T;
  remoteDocument.append(element);
  return { scene, remoteDocument, element };
}

export function createTestScene(documentAddress?: string): {
  scene: FullScreenMMLScene;
  remoteDocument: RemoteDocument;
} {
  const scene = new FullScreenMMLScene();
  const remoteDocument = document.createElement("m-remote-document") as RemoteDocument;
  remoteDocument.init(scene, documentAddress || "ws://localhost:8080");
  document.body.append(remoteDocument);
  return { scene, remoteDocument };
}
