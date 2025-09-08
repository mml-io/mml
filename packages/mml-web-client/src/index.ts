import {
  configureWindowForMML,
  FullScreenMMLScene,
  FullScreenMMLSceneOptions,
  GraphicsAdapter,
  IframeWrapper,
  MMLNetworkSource,
  MMLScene,
  NetworkedDOMWebsocketStatus,
  NetworkedDOMWebsocketStatusToString,
  registerCustomElementsToWindow,
  RemoteDocumentWrapper,
  StandaloneGraphicsAdapter,
  StandaloneTagDebugAdapter,
  StatusUI,
} from "@mml-io/mml-web";
import {
  StandaloneThreeJSAdapter,
  StandaloneThreeJSAdapterControlsType,
} from "@mml-io/mml-web-threejs-standalone";

const thisScript = document.currentScript as HTMLScriptElement;
const scriptUrl = new URL(thisScript.src);

declare global {
  interface Window {
    "mml-web-client": {
      mmlScene: MMLScene<StandaloneGraphicsAdapter>;
      remoteDocumentWrapper: RemoteDocumentWrapper<GraphicsAdapter>;
    };
  }
}

(function () {
  async function getGraphicsAdapter(element: HTMLElement): Promise<StandaloneGraphicsAdapter> {
    if (window.location.search.includes("playcanvas")) {
      const { StandalonePlayCanvasAdapter, StandalonePlayCanvasAdapterControlsType } = await import(
        "@mml-io/mml-web-playcanvas-standalone"
      );
      return StandalonePlayCanvasAdapter.create(element, {
        controlsType: StandalonePlayCanvasAdapterControlsType.DragFly,
      });
    } else if (window.location.search.includes("tags")) {
      return StandaloneTagDebugAdapter.create(element);
    } else {
      return StandaloneThreeJSAdapter.create(element, {
        controlsType: StandaloneThreeJSAdapterControlsType.DragFly,
      });
    }
  }

  const urlSearchParams = new URLSearchParams(window.location.search);

  const useIframe =
    scriptUrl.searchParams.get("iframe") === "true" || urlSearchParams.get("iframe") === "true";

  const allowOverlay =
    scriptUrl.searchParams.get("allowOverlay") === "true" ||
    urlSearchParams.get("allowOverlay") === "true";

  const fullScreenMMLSceneOptions: FullScreenMMLSceneOptions = {
    allowOverlay,
  };

  const url = scriptUrl.searchParams.get("url");
  if (!url) {
    // The custom elements are assumed to already be on the page after this script - register the custom elements
    // handler before the page loads. If any elements are already present then undefined behaviour may occur.
    configureWindowForMML(window, getGraphicsAdapter, fullScreenMMLSceneOptions);
    return;
  }

  window.addEventListener("load", async () => {
    const fullScreenMMLScene = new FullScreenMMLScene(fullScreenMMLSceneOptions);
    document.body.append(fullScreenMMLScene.element);

    const graphicsAdapter = await getGraphicsAdapter(fullScreenMMLScene.element);

    fullScreenMMLScene.init(graphicsAdapter);

    let targetForWrappers: HTMLElement;
    let windowTarget: Window;

    if (useIframe) {
      const { iframeWindow, iframeBody } = await IframeWrapper.create();
      windowTarget = iframeWindow;
      targetForWrappers = iframeBody;
    } else {
      targetForWrappers = document.body;
      windowTarget = window;
    }
    registerCustomElementsToWindow(windowTarget);

    const statusUI = new StatusUI();

    const mmlNetworkSource = MMLNetworkSource.create({
      url,
      mmlScene: fullScreenMMLScene,
      statusUpdated: (status: NetworkedDOMWebsocketStatus) => {
        if (status === NetworkedDOMWebsocketStatus.Connected) {
          statusUI.setNoStatus();
          fullScreenMMLScene.getLoadingProgressManager().setInitialLoad(true);
        } else {
          statusUI.setStatus(NetworkedDOMWebsocketStatusToString(status));
        }
      },
      windowTarget,
      targetForWrappers,
      allowOverlay,
    });

    const defineGlobals = scriptUrl.searchParams.get("defineGlobals") === "true";
    if (defineGlobals) {
      // Define the global mml-web-client object on the window for testing purposes
      window["mml-web-client"] = {
        mmlScene: fullScreenMMLScene,
        remoteDocumentWrapper: mmlNetworkSource.remoteDocumentWrapper,
      };
    }
  });
})();
