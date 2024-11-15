import { consumeEventEventName } from "../common";
import { getGlobalDocumentTimeManager, getGlobalMMLScene } from "../global";
import { MElementGraphics } from "../graphics/MElementGraphics";
import { GraphicsAdapter } from "../GraphicsAdapter";
import { LoadingProgressManager } from "../loading/LoadingProgressManager";
import { MMLDocumentTimeManager } from "../MMLDocumentTimeManager";
import { IMMLScene, PositionAndRotation } from "../MMLScene";
import type { RemoteDocument } from "./RemoteDocument";

export const MELEMENT_PROPERTY_NAME = "m-element-property";

export abstract class MElement<G extends GraphicsAdapter = GraphicsAdapter> extends HTMLElement {
  // This allows switching which document this HTMLElement subclass extends so that it can be placed into iframes
  static overwriteSuperclass(newSuperclass: typeof HTMLElement) {
    (MElement as any).__proto__ = newSuperclass;
  }

  static get observedAttributes(): Array<string> {
    return [];
  }

  private mElementGraphics: MElementGraphics<G> | null = null;

  constructor() {
    super();
  }

  static getMElementFromObject(object: unknown): MElement<GraphicsAdapter> | null {
    return (object as any)[MELEMENT_PROPERTY_NAME] || null;
  }

  public abstract isClickable(): boolean;

  public abstract parentTransformed(): void;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public addSideEffectChild(child: MElement<G>): void {
    // no-op
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public removeSideEffectChild(child: MElement<G>): void {
    // no-op
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    // no-op
  }

  public getScene(): IMMLScene<G> {
    const remoteDocumentElement = this.getInitiatedRemoteDocument();
    if (remoteDocumentElement) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return (remoteDocumentElement as RemoteDocument<G>).getMMLScene()!;
    }
    const globalScene = getGlobalMMLScene() as IMMLScene<G>;
    if (!globalScene) {
      throw new Error("No scene attachment found and no global scene found");
    }
    return globalScene;
  }

  public getInitiatedRemoteDocument(): RemoteDocument<G> | null {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    for (let parentNode: ParentNode | null = this; parentNode; parentNode = parentNode.parentNode) {
      if (
        parentNode.nodeName === "M-REMOTE-DOCUMENT" &&
        (parentNode as RemoteDocument<G>).getMMLScene()
      ) {
        // Return the first remote document that has an explicit scene set
        return parentNode as RemoteDocument<G>;
      }
    }
    return null;
  }

  public contentSrcToContentAddress(src: string): string {
    // Convert the potentially relative src to an absolute address using the document host
    const documentLocation = this.getDocumentHost();
    // First check if the src is a host-relative path
    try {
      // Check if the src is a valid URL - if so then it's already absolute
      const url = new URL(src);
      return url.toString();
    } catch {
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
    const remoteDocument = this.getInitiatedRemoteDocument();
    if (remoteDocument) {
      const remoteDocumentAddress = remoteDocument.getDocumentAddress();
      if (remoteDocumentAddress) {
        const url = new URL(remoteDocumentAddress);
        return url;
      }
    }
    return window.location;
  }

  public getDocumentTime(): number {
    const documentTimeContextProvider = this.getDocumentTimeManager();
    if (documentTimeContextProvider) {
      return documentTimeContextProvider.getDocumentTime();
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return Number(document.timeline.currentTime!);
  }

  public getWindowTime(): number {
    const documentTimeContextProvider = this.getDocumentTimeManager();
    if (documentTimeContextProvider) {
      return documentTimeContextProvider.getWindowTime();
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return Number(document.timeline.currentTime!);
  }

  public getLoadingProgressManager(): LoadingProgressManager | null {
    const scene = this.getScene();
    if (scene) {
      return scene.getLoadingProgressManager?.() || null;
    }
    return null;
  }

  protected getDocumentTimeManager(): MMLDocumentTimeManager | null {
    const remoteDocument = this.getInitiatedRemoteDocument();
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

  getContainer(): G["containerType"] {
    const container = this.mElementGraphics?.getContainer();
    if (!container) {
      throw new Error("No container found");
    }
    return container;
  }

  getUserPositionAndRotation(): PositionAndRotation {
    const remoteDocument = this.getScene();
    if (!remoteDocument) {
      throw new Error("No scene to retrieve user position from");
    }
    return remoteDocument.getUserPositionAndRotation();
  }

  dispatchEvent(event: Event): boolean {
    const remoteDocument = this.getInitiatedRemoteDocument();
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

  public getMElementParent(): MElement<G> | null {
    let parentNode = this.parentNode;
    while (parentNode != null) {
      if (parentNode instanceof MElement) {
        return parentNode;
      }
      parentNode = parentNode.parentNode;
    }
    return null;
  }

  public connectedCallback(): void {
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    if (!graphicsAdapter || this.mElementGraphics) {
      return;
    }

    this.mElementGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MElementGraphicsInterface(this);
  }

  disconnectedCallback() {
    this.mElementGraphics?.dispose();
    this.mElementGraphics = null;
  }
}
