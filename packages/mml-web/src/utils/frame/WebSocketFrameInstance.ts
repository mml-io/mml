import { NetworkedDOMWebsocket, NetworkedDOMWebsocketStatus } from "@mml-io/networked-dom-web";
import * as THREE from "three";

import { createWrappedScene } from "./CreateWrappedScene";
import { IMMLScene } from "../../MMLScene";
import { RemoteDocumentWrapper } from "../../websocket/RemoteDocumentWrapper";
import { getReconnectingStatus } from "../reconnecting-status";

export class WebSocketFrameInstance {
  public readonly src: string;
  public readonly container: THREE.Group;
  private domWebsocket: NetworkedDOMWebsocket;
  private remoteDocumentWrapper: RemoteDocumentWrapper;
  private targetForWrapper: HTMLElement;
  private scene: IMMLScene;
  private statusElement: THREE.Mesh | null = null;

  constructor(targetElement: HTMLElement, src: string, scene: IMMLScene) {
    this.targetForWrapper = targetElement;
    this.src = src;
    this.scene = scene;
    this.container = new THREE.Group();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const windowTarget = targetElement.ownerDocument.defaultView!;

    let overriddenHandler: ((element: HTMLElement, event: CustomEvent) => void) | null = null;
    const eventHandler = (element: HTMLElement, event: CustomEvent) => {
      if (!overriddenHandler) {
        throw new Error("overriddenHandler not set");
      }
      overriddenHandler(element, event);
    };

    const wrappedScene: IMMLScene = createWrappedScene(this.scene, this.container);

    this.remoteDocumentWrapper = new RemoteDocumentWrapper(
      windowTarget,
      wrappedScene,
      eventHandler,
    );
    this.targetForWrapper.append(this.remoteDocumentWrapper.element);
    this.domWebsocket = new NetworkedDOMWebsocket(
      this.src,
      NetworkedDOMWebsocket.createWebSocket,
      this.remoteDocumentWrapper.element,
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
        }
      },
    );
    overriddenHandler = (element: HTMLElement, event: CustomEvent) => {
      this.domWebsocket.handleEvent(element, event);
    };
  }

  dispose() {
    this.domWebsocket.stop();
    this.targetForWrapper.removeChild(this.remoteDocumentWrapper.element);
  }
}
