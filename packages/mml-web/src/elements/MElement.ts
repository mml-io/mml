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
  /**
   * Switches MElement's superclass to extend a target window's HTMLElement so that
   * MML elements can be placed into iframes. Also stores a reference to the target
   * window so that events can be created using its constructors (native dispatchEvent
   * rejects cross-realm Event objects).
   */
  static overwriteSuperclass(
    newSuperclass: { new (): HTMLElement; prototype: HTMLElement },
    targetWindow: Window & typeof globalThis,
  ) {
    Object.setPrototypeOf(MElement, newSuperclass);
    Object.setPrototypeOf(MElement.prototype, newSuperclass.prototype);
    // Invalidate cached dispatchEvent since the prototype chain has changed
    MElement.cachedBaseDispatchEvent = null;
    MElement._isDOMMode = true;
    MElement._domModeWindow = targetWindow;
  }

  /**
   * Resets MElement back to virtual (non-DOM) mode by restoring VirtualHTMLElement as
   * the superclass and clearing the DOM mode window reference.
   * @internal
   */
  static resetToVirtualMode() {
    Object.setPrototypeOf(MElement, VirtualHTMLElement);
    Object.setPrototypeOf(MElement.prototype, VirtualHTMLElement.prototype);
    MElement.cachedBaseDispatchEvent = null;
    MElement._isDOMMode = false;
    MElement._domModeWindow = null;
  }

  /**
   * Whether MElement has been switched to DOM mode via overwriteSuperclass.
   * Used instead of `instanceof Element` checks which fail across iframe boundaries
   * (cross-realm instanceof returns false).
   * @internal
   */
  private static _isDOMMode = false;
  static get isDOMMode(): boolean {
    return MElement._isDOMMode;
  }

  /**
   * The target window for DOM mode. Used to create events in the correct realm
   * so that native dispatchEvent accepts them.
   * @internal
   */
  private static _domModeWindow: (Window & typeof globalThis) | null = null;
  static get domModeWindow(): (Window & typeof globalThis) | null {
    return MElement._domModeWindow;
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
    return (
      ((object as Record<string, unknown>)[MELEMENT_PROPERTY_NAME] as
        | MElement<GraphicsAdapter>
        | undefined) ?? null
    );
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
    // In DOM mode, create the CustomEvent using the target window's constructor so that
    // it belongs to the same realm as native dispatchEvent (which rejects cross-realm events).
    if (MElement.isDOMMode && MElement.domModeWindow) {
      return new MElement.domModeWindow.CustomEvent(consumeEventEventName, {
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
      remoteDocument.dispatchEvent(MElement.createConsumeEvent(this, event));
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
