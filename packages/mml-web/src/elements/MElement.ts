import * as THREE from "three";

import { RemoteDocument } from "./RemoteDocument";
import { consumeEventEventName, documentTimeChangedEventName } from "../common";
import { getGlobalMScene } from "../global";
import { IMMLScene, PositionAndRotation } from "../MMLScene";

const MELEMENT_PROPERTY_NAME = "m-element-property";

const EmptyBounds = new THREE.Box3().makeEmpty();

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
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    // no-op
  }

  public getScene(): IMMLScene {
    const sceneAttachmentElement = this.getRemoteDocument();
    if (sceneAttachmentElement) {
      return (sceneAttachmentElement as RemoteDocument).getMScene();
    }
    const globalScene = getGlobalMScene();
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

  protected getDocumentTime(): number | null {
    const documentTimeContextProvider = this.getRemoteDocument();
    if (documentTimeContextProvider) {
      return (documentTimeContextProvider as RemoteDocument).getDocumentTime();
    }
    return null;
  }

  protected addDocumentTimeListener(cb: (documentTimeEvent: CustomEvent<number>) => void): {
    remove: () => void;
  } {
    const documentTimeContextProvider = this.getRemoteDocument();
    if (documentTimeContextProvider) {
      (documentTimeContextProvider as RemoteDocument).addEventListener(
        documentTimeChangedEventName,
        cb,
      );

      return {
        remove: () => {
          (documentTimeContextProvider as RemoteDocument).removeEventListener(
            documentTimeChangedEventName,
            cb,
          );
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

  getBounds(): THREE.Box3 {
    return EmptyBounds;
  }

  getCamera(): THREE.Camera {
    const sceneAttachment = this.getScene();
    return sceneAttachment.getCamera();
  }

  getUserPositionAndRotation(): PositionAndRotation {
    const sceneAttachment = this.getScene();
    if (!sceneAttachment) {
      throw new Error("No scene to retrieve user position from");
    }
    return sceneAttachment.getUserPositionAndRotation();
  }

  getAudioListener(): THREE.AudioListener {
    const sceneAttachment = this.getScene();
    return sceneAttachment.getAudioListener();
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

  connectedCallback() {
    if (this.currentParentContainer !== null) {
      throw new Error("Already connected to a parent");
    }

    let parentNode = this.parentNode;
    while (parentNode != null) {
      if (parentNode instanceof MElement) {
        this.currentParentContainer = parentNode.container;
        this.currentParentContainer.add(this.container);
        return;
      }
      parentNode = parentNode.parentNode;
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
