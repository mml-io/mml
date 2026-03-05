import { PlayCanvasGraphicsAdapter } from "@mml-io/mml-web-playcanvas";
import {
  StandalonePlayCanvasAdapter,
  StandalonePlayCanvasAdapterControlsType,
} from "@mml-io/mml-web-playcanvas-standalone";
import { ThreeJSGraphicsAdapter } from "@mml-io/mml-web-threejs";
import {
  StandaloneThreeJSAdapter,
  StandaloneThreeJSAdapterControlsType,
} from "@mml-io/mml-web-threejs-standalone";

import { FullScreenMMLScene, RemoteDocument } from "../build/index";

const useThree = true;

export async function createSceneAttachedElement<T>(
  elementTag: string,
  documentAddress?: string,
): Promise<{
  scene: FullScreenMMLScene<StandaloneThreeJSAdapter | StandalonePlayCanvasAdapter>;
  remoteDocument: RemoteDocument;
  element: T;
}> {
  const { scene, remoteDocument } = await createTestScene(documentAddress);

  // After registerCustomElementsToWindow, MML elements extend HTMLElement at runtime
  // even though they statically extend VirtualHTMLElement
  const element = document.createElement(elementTag) as unknown as T;
  (remoteDocument as unknown as HTMLElement).append(element as unknown as Node);
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
  // After registerCustomElementsToWindow, RemoteDocument extends HTMLElement at runtime
  const remoteDocument = document.createElement("m-remote-document") as unknown as RemoteDocument<
    ThreeJSGraphicsAdapter | PlayCanvasGraphicsAdapter
  >;
  scene.init(graphicsAdapter);
  remoteDocument.init(scene, documentAddress || "ws://localhost:8080");
  document.body.append(remoteDocument as unknown as Node);
  return { scene, remoteDocument };
}
