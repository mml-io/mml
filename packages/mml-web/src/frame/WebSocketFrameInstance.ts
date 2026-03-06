import {
  NetworkedDOMWebsocket,
  NetworkedDOMWebsocketStatus,
  VIRTUAL_DOCUMENT_BRAND,
} from "@mml-io/networked-dom-web";

import { consumeEventEventName, MElement } from "../elements";
import { GraphicsAdapter } from "../graphics";
import { LoadingProgressManager } from "../loading";
import { MMLNetworkSource } from "../network";
import { DocumentSource, RemoteDocumentWrapper } from "../remote-document";
import { getGlobalWindow } from "../runtime-env";
import { IMMLScene } from "../scene";
import { VirtualCustomEvent } from "../virtual-dom";
import { createWrappedScene } from "./CreateWrappedScene";

export class WebSocketFrameInstance<G extends GraphicsAdapter = GraphicsAdapter> {
  public readonly src: string;
  private domWebsocket: NetworkedDOMWebsocket;
  private targetForWrapper: MElement<G>;
  private readonly remoteDocumentWrapper: RemoteDocumentWrapper<G>;
  private scene: IMMLScene<G>;
  private loadingProgressManager: LoadingProgressManager;

  constructor(targetElement: MElement<G>, src: string, scene: IMMLScene<G>) {
    this.targetForWrapper = targetElement;
    this.src = src;
    this.scene = scene;

    const isVirtual = (targetElement.ownerDocument as any)?.[VIRTUAL_DOCUMENT_BRAND] === true;
    const windowTarget = isVirtual
      ? targetElement.ownerDocument
      : (targetElement.ownerDocument?.defaultView ?? getGlobalWindow() ?? null);

    let overriddenHandler: ((element: MElement<G>, event: CustomEvent) => void) | null = null;
    const eventHandler = (element: MElement<G>, event: CustomEvent) => {
      if (!overriddenHandler) {
        throw new Error("overriddenHandler not set");
      }
      overriddenHandler(element, event);
    };

    this.loadingProgressManager = new LoadingProgressManager();
    this.loadingProgressManager.addProgressCallback(() => {
      scene.getLoadingProgressManager?.()?.updateDocumentProgress(this);
    });

    const websocketAddress = MMLNetworkSource.resolveRelativeUrl(this.getDocumentHost(), this.src);

    scene
      .getLoadingProgressManager?.()
      ?.addLoadingDocument(this, websocketAddress, this.loadingProgressManager);

    const wrappedScene: IMMLScene<G> = createWrappedScene(this.scene, this.loadingProgressManager);

    this.remoteDocumentWrapper = new RemoteDocumentWrapper(
      websocketAddress,
      windowTarget as DocumentSource,
      wrappedScene,
      () => {
        // Events targeting static MML frames should not be sent
      },
    );

    this.targetForWrapper.append(this.remoteDocumentWrapper.remoteDocument);

    this.remoteDocumentWrapper.remoteDocument.addEventListener(
      consumeEventEventName,
      (wrappedEvent: CustomEvent | VirtualCustomEvent) => {
        const { originalEvent, element } = wrappedEvent.detail;
        eventHandler(element, originalEvent);
      },
    );

    this.domWebsocket = new NetworkedDOMWebsocket(
      websocketAddress,
      NetworkedDOMWebsocket.createWebSocket,
      this.remoteDocumentWrapper.remoteDocument,
      (time: number) => {
        this.remoteDocumentWrapper.remoteDocument.getDocumentTimeManager().setDocumentTime(time);
      },
      (status: NetworkedDOMWebsocketStatus) => {
        if (status === NetworkedDOMWebsocketStatus.Reconnecting) {
          this.remoteDocumentWrapper.remoteDocument.showError(true);
          this.loadingProgressManager.setInitialLoad(new Error("Failed to connect"));
        } else if (status === NetworkedDOMWebsocketStatus.Connected) {
          this.remoteDocumentWrapper.remoteDocument.showError(false);
          this.loadingProgressManager.setInitialLoad(true);
        } else {
          this.remoteDocumentWrapper.remoteDocument.showError(false);
        }
      },
      {
        tagPrefix: "m-",
      },
    );
    overriddenHandler = (element: MElement<G>, event: CustomEvent) => {
      this.domWebsocket.handleEvent(element, event);
    };
  }

  private getDocumentHost(): string {
    const remoteDocument = this.targetForWrapper.getInitiatedRemoteDocument();
    if (remoteDocument) {
      const remoteDocumentAddress = remoteDocument.getDocumentAddress();
      if (remoteDocumentAddress) {
        const url = new URL(remoteDocumentAddress);
        return url.host;
      }
    }
    const win = getGlobalWindow();
    if (win) {
      return win.location.host;
    }
    throw new Error("No document host found and window is not available");
  }

  dispose() {
    this.domWebsocket.stop();
    this.targetForWrapper.removeChild(this.remoteDocumentWrapper.remoteDocument);
    this.scene.getLoadingProgressManager?.()?.removeLoadingDocument(this);
  }
}
