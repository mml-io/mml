import {
  StandalonePlayCanvasAdapter,
  StandalonePlayCanvasAdapterControlsType,
} from "@mml-io/mml-web-playcanvas-client";
import {
  StandaloneThreeJSAdapter,
  StandaloneThreeJSAdapterControlsType,
} from "@mml-io/mml-web-three-client";
import {
  configureWindowForMML,
  FullScreenMMLScene,
  IframeWrapper,
  MMLScene,
  NetworkedDOMWebsocket,
  NetworkedDOMWebsocketStatus,
  registerCustomElementsToWindow,
  RemoteDocumentWrapper,
  StandaloneGraphicsAdapter,
  StandaloneTagDebugAdapter,
} from "mml-web";

const thisScript = document.currentScript as HTMLScriptElement;
const scriptUrl = new URL(thisScript.src);

declare global {
  interface Window {
    "mml-web-client": {
      mmlScene: MMLScene<StandaloneGraphicsAdapter>;
      remoteDocuments: RemoteDocumentWrapper<StandaloneGraphicsAdapter>[];
    };
  }
}

function createStatusElement() {
  const statusElement = document.createElement("div");
  statusElement.style.position = "fixed";
  statusElement.style.top = "50%";
  statusElement.style.left = "50%";
  statusElement.style.transform = "translate(-50%, -50%)";
  statusElement.style.zIndex = "1000";
  statusElement.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  statusElement.style.color = "white";
  statusElement.style.padding = "1em";
  statusElement.style.fontFamily = "sans-serif";
  statusElement.style.fontSize = "1.5em";
  statusElement.style.fontWeight = "bold";
  statusElement.style.pointerEvents = "none";
  statusElement.style.display = "none";
  document.body.append(statusElement);
  return statusElement;
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

  const websocketUrl = scriptUrl.searchParams.get("websocketUrl");
  if (!websocketUrl) {
    // The custom elements are assumed to already be on the page after this script - register the custom elements
    // handler before the page loads. If any elements are already present then undefined behaviour may occur.
    configureWindowForMML(window, getGraphicsAdapter);
    return;
  }

  window.addEventListener("load", async () => {
    const element = document.createElement("div");
    element.style.width = "100%";
    element.style.height = "100%";
    element.style.position = "relative";
    document.body.append(element);

    const graphicsAdapter = await getGraphicsAdapter(element);

    const fullScreenMMLScene = new FullScreenMMLScene(element);
    fullScreenMMLScene.init(graphicsAdapter);

    const useIframe = new URL(window.location.href).searchParams.get("iframe") === "true";
    const documentWebsocketUrls = websocketUrl.split(",");

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

    const remoteDocuments: RemoteDocumentWrapper<StandaloneGraphicsAdapter>[] = [];
    for (const documentWebsocketUrl of documentWebsocketUrls) {
      let overriddenHandler: ((element: HTMLElement, event: CustomEvent) => void) | null = null;
      const eventHandler = (element: HTMLElement, event: CustomEvent) => {
        if (!overriddenHandler) {
          throw new Error("overriddenHandler not set");
        }
        overriddenHandler(element, event);
      };
      const statusElement = createStatusElement();
      const remoteDocumentWrapper = new RemoteDocumentWrapper(
        window.location.href,
        windowTarget,
        fullScreenMMLScene,
        eventHandler,
      );
      remoteDocuments.push(remoteDocumentWrapper);
      targetForWrappers.append(remoteDocumentWrapper.remoteDocument);
      const websocket = new NetworkedDOMWebsocket(
        documentWebsocketUrl,
        NetworkedDOMWebsocket.createWebSocket,
        remoteDocumentWrapper.remoteDocument,
        (time: number) => {
          remoteDocumentWrapper.setDocumentTime(time);
        },
        (status: NetworkedDOMWebsocketStatus) => {
          if (status === NetworkedDOMWebsocketStatus.Connected) {
            statusElement.style.display = "none";
            fullScreenMMLScene.getLoadingProgressManager().setInitialLoad(true);
          } else {
            statusElement.style.display = "block";
            statusElement.textContent = NetworkedDOMWebsocketStatus[status];
          }
        },
      );
      overriddenHandler = (element: HTMLElement, event: CustomEvent) => {
        websocket.handleEvent(element, event);
      };
    }

    const defineGlobals = scriptUrl.searchParams.get("defineGlobals") === "true";
    if (defineGlobals) {
      // Define the global mml-web-client object on the window for testing purposes
      window["mml-web-client"] = {
        mmlScene: fullScreenMMLScene,
        remoteDocuments,
      };
    }
  });
})();
