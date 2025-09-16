import { NetworkedDOMWebsocket, NetworkedDOMWebsocketStatus } from "@mml-io/networked-dom-web";

import { createWrappedScene } from "../frame";
import { LoadingProgressManager } from "../loading";
import { fetchRemoteStaticMML, RemoteDocumentWrapper } from "../remote-document";
import { IMMLScene } from "../scene";

export type MMLNetworkSourceOptions = {
  url: string;
  mmlScene: IMMLScene;
  statusUpdated: (status: NetworkedDOMWebsocketStatus) => void;
  windowTarget: Window;
  targetForWrappers: HTMLElement;
  allowOverlay?: boolean;
};

export class MMLNetworkSource {
  private websocket: NetworkedDOMWebsocket | null = null;
  public remoteDocumentWrapper: RemoteDocumentWrapper;

  private constructor(private options: MMLNetworkSourceOptions) {}

  static create(options: MMLNetworkSourceOptions) {
    const mmlNetworkSource = new MMLNetworkSource(options);
    mmlNetworkSource.init();
    return mmlNetworkSource;
  }

  private init() {
    let overriddenHandler: ((element: HTMLElement, event: CustomEvent) => void) | null = null;
    const eventHandler = (element: HTMLElement, event: CustomEvent) => {
      if (!overriddenHandler) {
        throw new Error("overriddenHandler not set");
      }
      overriddenHandler(element, event);
    };

    const loadingProgressManager = new LoadingProgressManager();

    const wrappedScene = createWrappedScene(this.options.mmlScene, loadingProgressManager);

    const src = this.options.url;
    this.remoteDocumentWrapper = new RemoteDocumentWrapper(
      src,
      this.options.windowTarget,
      wrappedScene,
      eventHandler,
    );
    this.options.targetForWrappers.append(this.remoteDocumentWrapper.remoteDocument);

    let sceneLoadingProgressManager: LoadingProgressManager | null = null;
    if (this.options.mmlScene.getLoadingProgressManager) {
      sceneLoadingProgressManager = this.options.mmlScene.getLoadingProgressManager();
      loadingProgressManager.addProgressCallback(() => {
        sceneLoadingProgressManager?.updateDocumentProgress(this);
      });
    }

    const isWebsocket = src.startsWith("ws://") || src.startsWith("wss://");
    if (isWebsocket) {
      const websocket = new NetworkedDOMWebsocket(
        this.options.url,
        NetworkedDOMWebsocket.createWebSocket,
        this.remoteDocumentWrapper.remoteDocument,
        (time: number) => {
          this.remoteDocumentWrapper.setDocumentTime(time);
        },
        (status: NetworkedDOMWebsocketStatus) => {
          if (status === NetworkedDOMWebsocketStatus.Reconnecting) {
            this.remoteDocumentWrapper.remoteDocument.showError(true);
            loadingProgressManager.setInitialLoad(new Error("Failed to connect"));
          } else if (status === NetworkedDOMWebsocketStatus.Connected) {
            this.remoteDocumentWrapper.remoteDocument.showError(false);
            loadingProgressManager.setInitialLoad(true);
          } else {
            this.remoteDocumentWrapper.remoteDocument.showError(false);
          }
          this.options.statusUpdated(status);
        },
        {
          tagPrefix: "m-",
          // If overlays are allowed, allow SVG elements to populate them
          allowSVGElements: this.options.allowOverlay,
        },
      );
      this.websocket = websocket;
      overriddenHandler = (element: HTMLElement, event: CustomEvent) => {
        websocket.handleEvent(element, event);
      };
    } else {
      fetchRemoteStaticMML(this.options.url)
        .then((remoteDocumentBody) => {
          this.remoteDocumentWrapper.remoteDocument.append(remoteDocumentBody);
          loadingProgressManager?.setInitialLoad(true);
        })
        .catch((err) => {
          loadingProgressManager?.setInitialLoad(err);
        });
      overriddenHandler = () => {
        // Do nothing
      };
    }

    sceneLoadingProgressManager?.addLoadingDocument(this, this.options.url, loadingProgressManager);
  }

  dispose() {
    if (this.websocket) {
      this.websocket.stop();
      this.websocket = null;
    }
    this.options.mmlScene.getLoadingProgressManager?.()?.removeLoadingDocument(this);
    this.remoteDocumentWrapper.remoteDocument.remove();
  }
}
