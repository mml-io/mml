import { PlayCanvasGraphicsAdapter } from "@mml-io/mml-web-playcanvas";
import { StandalonePlayCanvasAdapter } from "@mml-io/mml-web-playcanvas-standalone";
import { ThreeJSGraphicsAdapter } from "@mml-io/mml-web-threejs";
import {
  StandaloneThreeJSAdapter,
  StandaloneThreeJSAdapterControlsType,
} from "@mml-io/mml-web-threejs-standalone";

import {
  FullScreenMMLScene,
  registerCustomElementsToVirtualDocument,
  registerCustomElementsToWindow,
  RemoteDocument,
  VirtualDocument,
  VirtualNode,
} from "../build/index";

export type TestMode = "virtual" | "dom";

export interface ModeContext {
  mode: TestMode;
  createElement(tag: string): any;
  createTestScene(documentAddress?: string): Promise<{
    scene: FullScreenMMLScene<StandaloneThreeJSAdapter | StandalonePlayCanvasAdapter>;
    remoteDocument: RemoteDocument;
  }>;
  createSceneAttachedElement<T>(
    elementTag: string,
    documentAddress?: string,
  ): Promise<{
    scene: FullScreenMMLScene<StandaloneThreeJSAdapter | StandalonePlayCanvasAdapter>;
    remoteDocument: RemoteDocument;
    element: T;
  }>;
  cleanup(): void;
}

export function createModeContext(mode: TestMode): Promise<ModeContext> {
  if (mode === "dom") {
    registerCustomElementsToWindow(window);

    const createElement = (tag: string): any => document.createElement(tag);

    const createTestScene = async (
      documentAddress?: string,
    ): Promise<{
      scene: FullScreenMMLScene<StandaloneThreeJSAdapter | StandalonePlayCanvasAdapter>;
      remoteDocument: RemoteDocument;
    }> => {
      const scene = new FullScreenMMLScene<StandaloneThreeJSAdapter>();
      document.body.append(scene.element);
      const graphicsAdapter = await StandaloneThreeJSAdapter.create(scene.element, {
        controlsType: StandaloneThreeJSAdapterControlsType.DragFly,
      });
      // After registerCustomElementsToWindow, RemoteDocument extends HTMLElement at runtime
      const remoteDocument = document.createElement(
        "m-remote-document",
      ) as unknown as RemoteDocument<ThreeJSGraphicsAdapter | PlayCanvasGraphicsAdapter>;
      scene.init(graphicsAdapter);
      remoteDocument.init(scene, documentAddress || "ws://localhost:8080");
      document.body.append(remoteDocument as unknown as Node);
      return { scene, remoteDocument };
    };

    const createSceneAttachedElement = async <T>(
      elementTag: string,
      documentAddress?: string,
    ): Promise<{
      scene: FullScreenMMLScene<StandaloneThreeJSAdapter | StandalonePlayCanvasAdapter>;
      remoteDocument: RemoteDocument;
      element: T;
    }> => {
      const { scene, remoteDocument } = await createTestScene(documentAddress);
      const element = document.createElement(elementTag) as unknown as T;
      (remoteDocument as unknown as HTMLElement).append(element as unknown as Node);
      return { scene, remoteDocument, element };
    };

    const cleanup = () => {
      document.body.innerHTML = "";
    };

    return Promise.resolve({
      mode,
      createElement,
      createTestScene,
      createSceneAttachedElement,
      cleanup,
    });
  }

  // Virtual mode
  const doc = new VirtualDocument();
  registerCustomElementsToVirtualDocument(doc);
  const roots: VirtualNode[] = [];

  const createElement = (tag: string): any => doc.createElement(tag);

  const createTestScene = async (
    documentAddress?: string,
  ): Promise<{
    scene: FullScreenMMLScene<StandaloneThreeJSAdapter | StandalonePlayCanvasAdapter>;
    remoteDocument: RemoteDocument;
  }> => {
    const scene = new FullScreenMMLScene<StandaloneThreeJSAdapter>();
    document.body.append(scene.element);
    const graphicsAdapter = await StandaloneThreeJSAdapter.create(scene.element, {
      controlsType: StandaloneThreeJSAdapterControlsType.DragFly,
    });
    scene.init(graphicsAdapter);

    const root = new VirtualNode("root");
    roots.push(root);
    const remoteDocument = doc.createElement("m-remote-document") as unknown as RemoteDocument<
      ThreeJSGraphicsAdapter | PlayCanvasGraphicsAdapter
    >;
    root.appendChild(remoteDocument as unknown as VirtualNode);
    remoteDocument.init(scene, documentAddress || "ws://localhost:8080");
    root.setRootConnected(true);

    return { scene, remoteDocument };
  };

  const createSceneAttachedElement = async <T>(
    elementTag: string,
    documentAddress?: string,
  ): Promise<{
    scene: FullScreenMMLScene<StandaloneThreeJSAdapter | StandalonePlayCanvasAdapter>;
    remoteDocument: RemoteDocument;
    element: T;
  }> => {
    const { scene, remoteDocument } = await createTestScene(documentAddress);
    const element = doc.createElement(elementTag) as unknown as T;
    remoteDocument.append(element as unknown as VirtualNode);
    return { scene, remoteDocument, element };
  };

  const cleanup = () => {
    for (const root of roots) {
      root.setRootConnected(false);
    }
    roots.length = 0;
    // Also clean up any real DOM elements (e.g., canvas/scene elements appended to document.body)
    document.body.innerHTML = "";
  };

  return Promise.resolve({
    mode,
    createElement,
    createTestScene,
    createSceneAttachedElement,
    cleanup,
  });
}
