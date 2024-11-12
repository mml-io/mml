import {
  fetchRemoteStaticMML,
  FullScreenMMLScene,
  NetworkedDOMWebsocket,
  NetworkedDOMWebsocketStatus,
  RemoteDocumentWrapper,
  StandaloneGraphicsAdapter,
} from "mml-web";

import { MMLSource } from "./MMLSource";

export type FullScreenState = {
  dispose: () => void;
};

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

export function connectGraphicsAdapterToFullScreenScene({
  element,
  graphicsAdapter,
  source,
  windowTarget,
  targetForWrappers,
}: {
  element: HTMLElement;
  graphicsAdapter: StandaloneGraphicsAdapter;
  source: MMLSource;
  windowTarget: Window;
  targetForWrappers: HTMLElement;
}): FullScreenState {
  const fullScreenMMLScene = new FullScreenMMLScene(element);
  fullScreenMMLScene.init(graphicsAdapter);

  let overriddenHandler: ((element: HTMLElement, event: CustomEvent) => void) | null = null;
  const eventHandler = (element: HTMLElement, event: CustomEvent) => {
    if (!overriddenHandler) {
      throw new Error("overriddenHandler not set");
    }
    overriddenHandler(element, event);
  };

  const statusElement = createStatusElement();
  const src = source.url;
  const remoteDocumentWrapper = new RemoteDocumentWrapper(
    src,
    windowTarget,
    fullScreenMMLScene,
    eventHandler,
  );
  targetForWrappers.append(remoteDocumentWrapper.remoteDocument);
  const isWebsocket = src.startsWith("ws://") || src.startsWith("wss://");
  if (isWebsocket) {
    const websocket = new NetworkedDOMWebsocket(
      source.url,
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
      {
        tagPrefix: "m-",
      },
    );
    overriddenHandler = (element: HTMLElement, event: CustomEvent) => {
      websocket.handleEvent(element, event);
    };
    return {
      dispose: () => {
        statusElement.remove();
        remoteDocumentWrapper.remoteDocument.remove();
        fullScreenMMLScene.dispose();
        websocket.stop();
      },
    };
  } else {
    fetchRemoteStaticMML(source.url)
      .then((remoteDocumentBody) => {
        remoteDocumentWrapper.remoteDocument.append(remoteDocumentBody);
        fullScreenMMLScene.getLoadingProgressManager().setInitialLoad(true);
      })
      .catch((err) => {
        fullScreenMMLScene.getLoadingProgressManager().setInitialLoad(err);
      });
    overriddenHandler = () => {
      // Do nothing
    };
    return {
      dispose: () => {
        statusElement.remove();
        remoteDocumentWrapper.remoteDocument.remove();
        fullScreenMMLScene.dispose();
      },
    };
  }
}
