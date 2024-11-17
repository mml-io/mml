import {
  configureWindowForMML,
  FullScreenMMLScene,
  GraphicsAdapter,
  IframeWrapper,
  MMLNetworkSource,
  MMLScene,
  NetworkedDOMWebsocketStatus,
  registerCustomElementsToWindow,
  RemoteDocumentWrapper,
  StandaloneGraphicsAdapter,
  StandaloneTagDebugAdapter,
  StatusUI,
} from "@mml-io/mml-web";
import {
  StandalonePlayCanvasAdapter,
  StandalonePlayCanvasAdapterControlsType,
} from "@mml-io/mml-web-playcanvas-client";
import {
  StandaloneThreeJSAdapter,
  StandaloneThreeJSAdapterControlsType,
} from "@mml-io/mml-web-three-client";

const thisScript = document.currentScript as HTMLScriptElement;
const scriptUrl = new URL(thisScript.src);

declare global {
  interface Window {
    "mml-web-client": {
      mmlScene: MMLScene<StandaloneGraphicsAdapter>;
      remoteDocuments: RemoteDocumentWrapper<GraphicsAdapter>[];
    };
  }
}

(function () {
  function getGraphicsAdapter(element: HTMLElement): Promise<StandaloneGraphicsAdapter> {
    if (window.location.search.includes("playcanvas")) {
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

  const url = scriptUrl.searchParams.get("url");
  if (!url) {
    // The custom elements are assumed to already be on the page after this script - register the custom elements
    // handler before the page loads. If any elements are already present then undefined behaviour may occur.
    configureWindowForMML(window, getGraphicsAdapter);
    return;
  }

  window.addEventListener("load", async () => {
    const fullScreenMMLScene = new FullScreenMMLScene();
    document.body.append(fullScreenMMLScene.element);

    const graphicsAdapter = await getGraphicsAdapter(fullScreenMMLScene.element);

    fullScreenMMLScene.init(graphicsAdapter);

    const useIframe = new URL(window.location.href).searchParams.get("iframe") === "true";

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
          statusUI.setStatus(NetworkedDOMWebsocketStatus[status]);
        }
      },
      windowTarget,
      targetForWrappers,
    });

    const defineGlobals = scriptUrl.searchParams.get("defineGlobals") === "true";
    if (defineGlobals) {
      // Define the global mml-web-client object on the window for testing purposes
      window["mml-web-client"] = {
        mmlScene: fullScreenMMLScene,
        remoteDocuments: [mmlNetworkSource.remoteDocumentWrapper],
      };
    }
  });
})();
