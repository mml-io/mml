import {
  fetchRemoteStaticMML,
  FullScreenMMLScene,
  NetworkedDOMWebsocket,
  NetworkedDOMWebsocketStatus,
  RemoteDocumentWrapper,
  StandaloneGraphicsAdapter,
} from "mml-web";

import { StatusElement } from "./StatusElement";

export type MMLSourceDefinition = {
  url: string;
};

export type MMLSourceOptions = {
  fullScreenMMLScene: FullScreenMMLScene<StandaloneGraphicsAdapter>;
  statusElement: StatusElement;
  source: MMLSourceDefinition;
  windowTarget: Window;
  targetForWrappers: HTMLElement;
};

export class MMLSource {
  private websocket: NetworkedDOMWebsocket | null = null;
  private remoteDocumentWrapper: RemoteDocumentWrapper;

  private constructor(private options: MMLSourceOptions) {}

  static create(options: MMLSourceOptions) {
    const mmlSource = new MMLSource(options);
    mmlSource.init();
    return mmlSource;
  }

  private init() {
    let overriddenHandler: ((element: HTMLElement, event: CustomEvent) => void) | null = null;
    const eventHandler = (element: HTMLElement, event: CustomEvent) => {
      if (!overriddenHandler) {
        throw new Error("overriddenHandler not set");
      }
      overriddenHandler(element, event);
    };

    const src = this.options.source.url;
    this.remoteDocumentWrapper = new RemoteDocumentWrapper(
      src,
      this.options.windowTarget,
      this.options.fullScreenMMLScene,
      eventHandler,
    );
    this.options.targetForWrappers.append(this.remoteDocumentWrapper.remoteDocument);
    const isWebsocket = src.startsWith("ws://") || src.startsWith("wss://");
    if (isWebsocket) {
      const websocket = new NetworkedDOMWebsocket(
        this.options.source.url,
        NetworkedDOMWebsocket.createWebSocket,
        this.remoteDocumentWrapper.remoteDocument,
        (time: number) => {
          this.remoteDocumentWrapper.setDocumentTime(time);
        },
        (status: NetworkedDOMWebsocketStatus) => {
          if (status === NetworkedDOMWebsocketStatus.Connected) {
            this.options.statusElement.setNoStatus();
            this.options.fullScreenMMLScene.getLoadingProgressManager().setInitialLoad(true);
          } else {
            this.options.statusElement.setStatus(NetworkedDOMWebsocketStatus[status]);
          }
        },
        {
          tagPrefix: "m-",
        },
      );
      this.websocket = websocket;
      overriddenHandler = (element: HTMLElement, event: CustomEvent) => {
        websocket.handleEvent(element, event);
      };
    } else {
      fetchRemoteStaticMML(this.options.source.url)
        .then((remoteDocumentBody) => {
          this.remoteDocumentWrapper.remoteDocument.append(remoteDocumentBody);
          this.options.fullScreenMMLScene.getLoadingProgressManager().setInitialLoad(true);
        })
        .catch((err) => {
          this.options.fullScreenMMLScene.getLoadingProgressManager().setInitialLoad(err);
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
    this.options.fullScreenMMLScene.dispose();
  }
}
