import { NetworkedDOMWebsocket, NetworkedDOMWebsocketStatus } from "@mml-io/networked-dom-web";

import { LoadingProgressManager } from "../loading";
import { fetchRemoteStaticMML, RemoteDocumentWrapper } from "../remote-document";
import { IMMLScene } from "../scene";

export type MMLNetworkSourceOptions = {
  url: string;
  connectionToken?: string | null;
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

    const src = this.options.url;
    this.remoteDocumentWrapper = new RemoteDocumentWrapper(
      src,
      this.options.windowTarget,
      this.options.mmlScene,
      eventHandler,
    );
    this.options.targetForWrappers.append(this.remoteDocumentWrapper.remoteDocument);
    let loadingProgressManager: LoadingProgressManager | null;
    if (this.options.mmlScene.getLoadingProgressManager) {
      loadingProgressManager = this.options.mmlScene.getLoadingProgressManager();
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
          if (status === NetworkedDOMWebsocketStatus.Connected) {
            loadingProgressManager?.setInitialLoad(true);
          }
          this.options.statusUpdated(status);
        },
        {
          tagPrefix: "m-",
          // If overlays are allowed, allow SVG elements to populate them
          allowSVGElements: this.options.allowOverlay,
          connectionToken: this.options.connectionToken ?? null,
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
  }

  dispose() {
    if (this.websocket) {
      this.websocket.stop();
      this.websocket = null;
    }
    this.remoteDocumentWrapper.remoteDocument.remove();
  }
}
