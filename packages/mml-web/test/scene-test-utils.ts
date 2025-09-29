import { ThreeJSGraphicsAdapter } from "@mml-io/mml-web-threejs";
import {
  StandaloneThreeJSAdapter,
  StandaloneThreeJSAdapterControlsType,
} from "@mml-io/mml-web-threejs-standalone";

import { FullScreenMMLScene, RemoteDocument } from "../build/index";

export async function createSceneAttachedElement<T extends HTMLElement>(
  elementTag: string,
  documentAddress?: string,
): Promise<{
  scene: FullScreenMMLScene<StandaloneThreeJSAdapter>;
  remoteDocument: RemoteDocument;
  element: T;
}> {
  const { scene, remoteDocument } = await createTestScene(documentAddress);

  const element = document.createElement(elementTag) as T;
  remoteDocument.append(element);
  return { scene, remoteDocument, element };
}

export async function createTestScene(documentAddress?: string): Promise<{
  scene: FullScreenMMLScene<StandaloneThreeJSAdapter>;
  remoteDocument: RemoteDocument;
}> {
  const scene = new FullScreenMMLScene<typeof graphicsAdapter>();
  document.body.append(scene.element);
  const graphicsAdapter = await StandaloneThreeJSAdapter.create(scene.element, {
    controlsType: StandaloneThreeJSAdapterControlsType.DragFly,
  });
  const remoteDocument = document.createElement(
    "m-remote-document",
  ) as RemoteDocument<ThreeJSGraphicsAdapter>;
  scene.init(graphicsAdapter);
  remoteDocument.init(scene, documentAddress || "ws://localhost:8080");
  document.body.append(remoteDocument);
  return { scene, remoteDocument };
}
