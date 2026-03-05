import { getGlobalDocumentTimeManager, getGlobalMMLScene } from "../global";
import { GraphicsAdapter } from "../graphics";
import { MElementGraphics } from "../graphics";
import { LoadingProgressManager } from "../loading";
import { getGlobalDocument, getGlobalWindow } from "../runtime-env";
import { IMMLScene, PositionAndRotation } from "../scene";
import { MMLDocumentTimeManager } from "../time";
import { VirtualCustomEvent, VirtualHTMLElement, VirtualNode } from "../virtual-dom";
import type { RemoteDocument } from "./RemoteDocument";

export const MELEMENT_PROPERTY_NAME = "m-element-property";
export const consumeEventEventName = "consume-event";

export abstract class MElement<
  G extends GraphicsAdapter = GraphicsAdapter,
> extends VirtualHTMLElement {
  // This allows switching which document this HTMLElement subclass extends so that it can be placed into iframes
  static overwriteSuperclass(newSuperclass: { new (): any; prototype: any }) {
    Object.setPrototypeOf(MElement, newSuperclass);
    Object.setPrototypeOf(MElement.prototype, newSuperclass.prototype);
    // Invalidate cached base dispatchEvent since the prototype chain has changed
    MElement.cachedBaseDispatchEvent = null;
  }

  /**
   * Cached reference to the base class (VirtualHTMLElement or HTMLElement) dispatchEvent method.
   * Invalidated by overwriteSuperclass when the prototype chain changes.
   * @internal
   */
  private static cachedBaseDispatchEvent: ((event: Event | VirtualCustomEvent) => boolean) | null =
    null;

  static getBaseDispatchEvent(): (event: Event | VirtualCustomEvent) => boolean {
    if (!MElement.cachedBaseDispatchEvent) {
      MElement.cachedBaseDispatchEvent = Object.getPrototypeOf(MElement.prototype).dispatchEvent;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return MElement.cachedBaseDispatchEvent!;
  }

  static get observedAttributes(): Array<string> {
    return [];
  }

  private mElementGraphics: MElementGraphics<G> | null = null;

  constructor() {
    super();
  }

  public readonly isMElement = true;

  public static isMElement(element: object): element is MElement {
    return (element as MElement).isMElement;
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
    let parentNode: VirtualNode | null = this as VirtualNode;
    while (parentNode) {
      if (
        parentNode.nodeName === "M-REMOTE-DOCUMENT" &&
        (parentNode as RemoteDocument<G>).getMMLScene()
      ) {
        // Return the first remote document that has an explicit scene set
        return parentNode as RemoteDocument<G>;
      }
      parentNode = parentNode.parentNode;
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
    const win = getGlobalWindow();
    if (win) {
      return win.location;
    }
    throw new Error("No document host found and window is not available");
  }

  public getDocumentTime(): number {
    const documentTimeContextProvider = this.getDocumentTimeManager();
    if (documentTimeContextProvider) {
      return documentTimeContextProvider.getDocumentTime();
    }
    const doc = getGlobalDocument();
    if (doc?.timeline) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return Number(doc.timeline.currentTime!);
    }
    // Fallback for virtual mode: use performance.now() which matches the semantics of
    // document.timeline.currentTime (DOMHighResTimeStamp relative to time origin)
    return performance.now();
  }

  public getWindowTime(): number {
    const documentTimeContextProvider = this.getDocumentTimeManager();
    if (documentTimeContextProvider) {
      return documentTimeContextProvider.getWindowTime();
    }
    const doc = getGlobalDocument();
    if (doc?.timeline) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return Number(doc.timeline.currentTime!);
    }
    // Fallback for virtual mode: use performance.now() which matches the semantics of
    // document.timeline.currentTime (DOMHighResTimeStamp relative to time origin)
    return performance.now();
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

  static createConsumeEvent(
    element: MElement | VirtualHTMLElement,
    originalEvent: Event | VirtualCustomEvent,
  ): CustomEvent | VirtualCustomEvent {
    // Use instanceof Element to reliably detect DOM mode. Element covers both
    // HTMLElement and SVGElement (overlay portals may contain SVG content).
    if (typeof Element !== "undefined" && element instanceof Element) {
      return new CustomEvent(consumeEventEventName, {
        bubbles: false,
        detail: { element, originalEvent },
      });
    }
    return new VirtualCustomEvent(consumeEventEventName, {
      bubbles: false,
      detail: { element, originalEvent },
    });
  }

  dispatchEvent(event: Event | VirtualCustomEvent): boolean {
    const remoteDocument = this.getInitiatedRemoteDocument();
    if (remoteDocument) {
      // Only send the consume-event for the element on which dispatchEvent was originally called.
      // In virtual mode, event bubbling explicitly calls parent.dispatchEvent(event) on each
      // ancestor, which would create duplicate consume-events. In real DOM mode, the browser
      // handles bubbling internally without calling dispatchEvent on parents. This flag ensures
      // parity: only one consume-event per original dispatch, letting the server handle bubbling.
      if (!(event as any).__mml_consumed) {
        (event as any).__mml_consumed = true;
        remoteDocument.dispatchEvent(MElement.createConsumeEvent(this, event));
      }
      return super.dispatchEvent(event);
    } else {
      const win = getGlobalWindow();
      if (event.type !== "click" && win) {
        const script = this.getAttribute("on" + event.type.toLowerCase());
        if (script) {
          const handler = win["eval"](`(function(event){ ${script} })`);
          handler.apply(this, [event]);
        }
      }
      return super.dispatchEvent(event);
    }
  }

  public getMElementParent(): MElement<G> | null {
    let parentNode = this.parentNode;
    while (parentNode != null) {
      if (MElement.isMElement(parentNode)) {
        return parentNode as MElement<G>;
      }
      parentNode = parentNode.parentNode;
    }
    return null;
  }

  public connectedCallback(): void {
    if (!this.getScene().hasGraphicsAdapter() || this.mElementGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();

    this.mElementGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MElementGraphicsInterface(this);
  }

  disconnectedCallback() {
    this.mElementGraphics?.dispose();
    this.mElementGraphics = null;
  }
}
