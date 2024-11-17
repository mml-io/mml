import { PlayCanvasGraphicsAdapter } from "@mml-io/mml-web-playcanvas";
import {
  StandalonePlayCanvasAdapter,
  StandalonePlayCanvasAdapterControlsType,
} from "@mml-io/mml-web-playcanvas-client";
import { ThreeJSGraphicsAdapter } from "@mml-io/mml-web-three";
import {
  StandaloneThreeJSAdapter,
  StandaloneThreeJSAdapterControlsType,
} from "@mml-io/mml-web-three-client";

import { FullScreenMMLScene, RemoteDocument } from "../build/index";

const useThree = true;

export async function createSceneAttachedElement<T extends HTMLElement>(
  elementTag: string,
  documentAddress?: string,
): Promise<{
  scene: FullScreenMMLScene<StandaloneThreeJSAdapter | StandalonePlayCanvasAdapter>;
  remoteDocument: RemoteDocument;
  element: T;
}> {
  const { scene, remoteDocument } = await createTestScene(documentAddress);

  const element = document.createElement(elementTag) as T;
  remoteDocument.append(element);
  return { scene, remoteDocument, element };
}

export async function createTestScene(documentAddress?: string): Promise<{
  scene: FullScreenMMLScene<StandaloneThreeJSAdapter | StandalonePlayCanvasAdapter>;
  remoteDocument: RemoteDocument;
}> {
  const scene = new FullScreenMMLScene<typeof graphicsAdapter>();
  document.body.append(scene.element);
  let graphicsAdapter: StandaloneThreeJSAdapter | StandalonePlayCanvasAdapter;
  if (useThree) {
    graphicsAdapter = await StandaloneThreeJSAdapter.create(scene.element, {
      controlsType: StandaloneThreeJSAdapterControlsType.DragFly,
    });
  } else {
    graphicsAdapter = await StandalonePlayCanvasAdapter.create(scene.element, {
      controlsType: StandalonePlayCanvasAdapterControlsType.DragFly,
    });
  }
  const remoteDocument = document.createElement("m-remote-document") as RemoteDocument<
    ThreeJSGraphicsAdapter | PlayCanvasGraphicsAdapter
  >;
  scene.init(graphicsAdapter);
  remoteDocument.init(scene, documentAddress || "ws://localhost:8080");
  document.body.append(remoteDocument);
  return { scene, remoteDocument };
}
