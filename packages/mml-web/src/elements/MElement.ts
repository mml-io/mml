import * as THREE from "three";

import { RemoteDocument } from "./RemoteDocument";
import { consumeEventEventName } from "../common";
import { getGlobalDocumentTimeManager, getGlobalMMLScene } from "../global";
import { LoadingProgressManager } from "../loading/LoadingProgressManager";
import { MMLDocumentTimeManager } from "../MMLDocumentTimeManager";
import { IMMLScene, PositionAndRotation } from "../MMLScene";

const MELEMENT_PROPERTY_NAME = "m-element-property";

export abstract class MElement extends HTMLElement {
  // This allows switching which document this HTMLElement subclass extends so that it can be placed into iframes
  static overwriteSuperclass(newSuperclass: typeof HTMLElement) {
    (MElement as any).__proto__ = newSuperclass;
  }

  static get observedAttributes(): Array<string> {
    return [];
  }

  protected container: THREE.Group;
  private currentParentContainer: THREE.Object3D | null = null;

  constructor() {
    super();
    this.container = new THREE.Group();
    this.container.name = this.constructor.name;
    (this.container as any)[MELEMENT_PROPERTY_NAME] = this;
  }

  static getMElementFromObject(object: THREE.Object3D): MElement | null {
    return (object as any)[MELEMENT_PROPERTY_NAME] || null;
  }

  public abstract isClickable(): boolean;

  public abstract parentTransformed(): void;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public addSideEffectChild(child: MElement): void {
    // no-op
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public removeSideEffectChild(child: MElement): void {
    // no-op
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    // no-op
  }

  public getScene(): IMMLScene {
    const remoteDocumentElement = this.getRemoteDocument();
    if (remoteDocumentElement) {
      return (remoteDocumentElement as RemoteDocument).getMMLScene();
    }
    const globalScene = getGlobalMMLScene();
    if (!globalScene) {
      throw new Error("No scene attachment found and no global scene found");
    }
    return globalScene;
  }

  public getRemoteDocument(): RemoteDocument | null {
    return this.closest("m-remote-document") || null;
  }

  public contentSrcToContentAddress(src: string): string {
    // Convert the potentially relative src to an absolute address using the document host
    const documentLocation = this.getDocumentHost();
    // First check if the src is a host-relative path
    try {
      // Check if the src is a valid URL - if so then it's already absolute
      const url = new URL(src);
      return url.toString();
    } catch (err) {
      // Do nothing
    }
    let protocol = documentLocation.protocol;
    if (protocol === "ws:") {
      protocol = "http:";
    } else if (protocol === "wss:") {
      protocol = "https:";
    }
    if (src.startsWith("/")) {
      // If the src is host-relative then we can just use the document host
      return `${protocol}//${documentLocation.host}${src}`;
    } else {
      // Otherwise we need to use the document host as a base
      const path = documentLocation.pathname;
      const lastSlashIndex = path.lastIndexOf("/");
      if (lastSlashIndex === -1) {
        return `${protocol}//${documentLocation.host}/${src}`;
      }
      const pathWithoutFilename = path.substring(0, lastSlashIndex + 1);
      return `${protocol}//${documentLocation.host}${pathWithoutFilename}${src}`;
    }
  }

  private getDocumentHost(): URL | Location {
    const remoteDocument = this.getRemoteDocument();
    if (remoteDocument) {
      const remoteDocumentAddress = remoteDocument.getDocumentAddress();
      if (remoteDocumentAddress) {
        const url = new URL(remoteDocumentAddress);
        return url;
      }
    }
    return window.location;
  }

  public getDocumentTime(): number | null {
    const documentTimeContextProvider = this.getDocumentTimeManager();
    if (documentTimeContextProvider) {
      return documentTimeContextProvider.getDocumentTime();
    }
    return null;
  }

  public getWindowTime(): number {
    const documentTimeContextProvider = this.getDocumentTimeManager();
    if (documentTimeContextProvider) {
      return documentTimeContextProvider.getWindowTime();
    }
    return document.timeline.currentTime!;
  }

  protected getLoadingProgressManager(): LoadingProgressManager | null {
    const scene = this.getScene();
    if (scene) {
      return scene.getLoadingProgressManager?.() || null;
    }
    return null;
  }

  protected getDocumentTimeManager(): MMLDocumentTimeManager | null {
    const remoteDocument = this.getRemoteDocument();
    if (remoteDocument) {
      return remoteDocument.getDocumentTimeManager();
    }
    const globalDocumentTimeManager = getGlobalDocumentTimeManager();
    if (globalDocumentTimeManager) {
      return globalDocumentTimeManager;
    }
    return null;
  }

  public addDocumentTimeListener(cb: (documentTime: number) => void): {
    remove: () => void;
  } {
    const documentTimeManager = this.getDocumentTimeManager();
    if (documentTimeManager) {
      documentTimeManager.addDocumentTimeListenerCallback(cb);
      return {
        remove: () => {
          documentTimeManager.removeDocumentTimeListenerCallback(cb);
        },
      };
    } else {
      console.warn("No document time context provider found to add listener to");
      return {
        remove: () => {
          // no-op
        },
      };
    }
  }

  public addDocumentTimeTickListener(cb: (documentTime: number) => void): {
    remove: () => void;
  } {
    const documentTimeManager = this.getDocumentTimeManager();
    if (documentTimeManager) {
      documentTimeManager.addDocumentTimeTickListenerCallback(cb);
      return {
        remove: () => {
          documentTimeManager.removeDocumentTimeTickListenerCallback(cb);
        },
      };
    } else {
      console.warn("No document time context provider found to add listener to");
      return {
        remove: () => {
          // no-op
        },
      };
    }
  }

  getContainer(): THREE.Group {
    return this.container;
  }

  getCamera(): THREE.Camera {
    const remoteDocument = this.getScene();
    return remoteDocument.getCamera();
  }

  getUserPositionAndRotation(): PositionAndRotation {
    const remoteDocument = this.getScene();
    if (!remoteDocument) {
      throw new Error("No scene to retrieve user position from");
    }
    return remoteDocument.getUserPositionAndRotation();
  }

  getAudioListener(): THREE.AudioListener {
    const remoteDocument = this.getScene();
    return remoteDocument.getAudioListener();
  }

  dispatchEvent(event: Event): boolean {
    const remoteDocument = this.getRemoteDocument();
    if (remoteDocument) {
      remoteDocument.dispatchEvent(
        new CustomEvent(consumeEventEventName, {
          bubbles: false,
          detail: { element: this, originalEvent: event },
        }),
      );
      return super.dispatchEvent(event);
    } else {
      if (event.type !== "click") {
        const script = this.getAttribute("on" + event.type.toLowerCase());
        if (script) {
          const handler = window["eval"](`(function(event){ ${script} })`);
          handler.apply(this, [event]);
        }
      }
      return super.dispatchEvent(event);
    }
  }

  private getMElementParent(): MElement | null {
    let parentNode = this.parentNode;
    while (parentNode != null) {
      if (parentNode instanceof MElement) {
        return parentNode;
      }
      parentNode = parentNode.parentNode;
    }
    return null;
  }

  connectedCallback() {
    if (this.currentParentContainer !== null) {
      throw new Error("Already connected to a parent");
    }

    const mElementParent = this.getMElementParent();
    if (mElementParent) {
      this.currentParentContainer = mElementParent.container;
      this.currentParentContainer.add(this.container);
      return;
    }

    // If none of the ancestors are MElements then this element may be directly connected to the body (without a wrapper).
    // Attempt to use a global scene that has been configured to attach this element to.
    const scene = this.getScene();
    this.currentParentContainer = scene.getRootContainer();
    this.currentParentContainer.add(this.container);
  }

  disconnectedCallback() {
    if (this.currentParentContainer === null) {
      throw new Error("Was not connected to a parent");
    }

    this.currentParentContainer.remove(this.container);
    this.currentParentContainer = null;
  }
}
