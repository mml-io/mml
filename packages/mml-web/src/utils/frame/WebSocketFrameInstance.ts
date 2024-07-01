import { NetworkedDOMWebsocket, NetworkedDOMWebsocketStatus } from "@mml-io/networked-dom-web";
import * as THREE from "three";

import { createWrappedScene } from "./CreateWrappedScene";
import { MElement } from "../../elements/MElement";
import { LoadingProgressManager } from "../../loading/LoadingProgressManager";
import { IMMLScene } from "../../MMLScene";
import { RemoteDocumentWrapper } from "../../websocket/RemoteDocumentWrapper";
import { getReconnectingStatus } from "../reconnecting-status";

export class WebSocketFrameInstance {
  public readonly src: string;
  public readonly container: THREE.Group;
  private domWebsocket: NetworkedDOMWebsocket;
  private remoteDocumentWrapper: RemoteDocumentWrapper;
  private targetForWrapper: MElement;
  private scene: IMMLScene;
  private statusElement: THREE.Mesh | null = null;
  private loadingProgressManagerForFrameContent: LoadingProgressManager;
  private parentLoadingProgressManager?: LoadingProgressManager | null;

  constructor(targetElement: MElement, src: string, scene: IMMLScene) {
    this.targetForWrapper = targetElement;
    this.src = src;
    this.scene = scene;
    this.container = new THREE.Group();
    this.parentLoadingProgressManager = scene.getLoadingProgressManager?.();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const windowTarget = targetElement.ownerDocument.defaultView!;

    let overriddenHandler: ((element: MElement, event: CustomEvent) => void) | null = null;
    const eventHandler = (element: MElement, event: CustomEvent) => {
      if (!overriddenHandler) {
        throw new Error("overriddenHandler not set");
      }
      overriddenHandler(element, event);
    };

    this.loadingProgressManagerForFrameContent = new LoadingProgressManager();
    this.loadingProgressManagerForFrameContent.addProgressCallback(() => {
      this.parentLoadingProgressManager?.updateDocumentProgress(this);
    });

    scene
      .getLoadingProgressManager?.()
      ?.addLoadingDocument(this, this.src, this.loadingProgressManagerForFrameContent);

    const wrappedScene: IMMLScene = createWrappedScene(
      this.scene,
      this.container,
      this.loadingProgressManagerForFrameContent,
    );

    const websocketAddress = this.srcToAddress(this.src);

    this.remoteDocumentWrapper = new RemoteDocumentWrapper(
      websocketAddress,
      windowTarget,
      wrappedScene,
      eventHandler,
    );
    this.targetForWrapper.append(this.remoteDocumentWrapper.remoteDocument);
    this.domWebsocket = new NetworkedDOMWebsocket(
      websocketAddress,
      NetworkedDOMWebsocket.createWebSocket,
      this.remoteDocumentWrapper.remoteDocument,
      (time: number) => {
        this.remoteDocumentWrapper.setDocumentTime(time);
      },
      (status: NetworkedDOMWebsocketStatus) => {
        if (this.statusElement !== null) {
          this.container.remove(this.statusElement);
          this.statusElement = null;
        }
        if (status === NetworkedDOMWebsocketStatus.Reconnecting) {
          const { geometry, material, height } = getReconnectingStatus();
          const mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> = new THREE.Mesh(
            geometry,
            material,
          );
          mesh.position.set(0, height / 2, 0);
          this.statusElement = mesh;
          this.container.add(this.statusElement);
          this.loadingProgressManagerForFrameContent.setInitialLoad(new Error("Failed to connect"));
        } else if (status === NetworkedDOMWebsocketStatus.Connected) {
          this.loadingProgressManagerForFrameContent.setInitialLoad(true);
        }
      },
    );
    overriddenHandler = (element: MElement, event: CustomEvent) => {
      this.domWebsocket.handleEvent(element, event);
    };
  }

  private srcToAddress(src: string): string {
    const insecurePrefix = "ws:///";
    const securePrefix = "wss:///";
    if (src.startsWith(insecurePrefix)) {
      // Relative insecure websocket path
      return `ws://${this.getDocumentHost()}/${src.substring(insecurePrefix.length)}`;
    } else if (src.startsWith(securePrefix)) {
      // Relative secure websocket path
      return `wss://${this.getDocumentHost()}/${src.substring(securePrefix.length)}`;
    } else {
      return src;
    }
  }

  private getDocumentHost(): string {
    const remoteDocument = this.targetForWrapper.getRemoteDocument();
    if (remoteDocument) {
      const remoteDocumentAddress = remoteDocument.getDocumentAddress();
      if (remoteDocumentAddress) {
        const url = new URL(remoteDocumentAddress);
        return url.host;
      }
    }
    return window.location.host;
  }

  dispose() {
    this.domWebsocket.stop();
    this.targetForWrapper.removeChild(this.remoteDocumentWrapper.remoteDocument);
    this.parentLoadingProgressManager?.removeLoadingDocument(this);
  }
}
