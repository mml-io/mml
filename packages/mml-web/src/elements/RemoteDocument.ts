import { consumeEventEventName } from "../common";
import { RemoteDocumentGraphics } from "../graphics/RemoteDocumentGraphics";
import { GraphicsAdapter } from "../GraphicsAdapter";
import { MMLDocumentTimeManager } from "../MMLDocumentTimeManager";
import { IMMLScene } from "../MMLScene";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";
import { MElement } from "./MElement";

export class RemoteDocument<G extends GraphicsAdapter = GraphicsAdapter> extends MElement<G> {
  static tagName = "m-remote-document";

  private scene: IMMLScene<G> | null = null;
  private documentAddress: string | null = null;
  private documentTimeManager: MMLDocumentTimeManager;
  private animationFrameCallback: number | null = null;
  private remoteDocumentGraphics: RemoteDocumentGraphics<G> | null;

  constructor() {
    super();
    this.documentTimeManager = new MMLDocumentTimeManager();

    this.addEventListener(consumeEventEventName, (wrappedEvent: CustomEvent) => {
      wrappedEvent.stopPropagation();
    });
  }

  public showError(showError: boolean) {
    this.remoteDocumentGraphics?.showError(showError);
  }

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  public getContentBounds(): OrientedBoundingBox | null {
    return null;
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return false;
  }

  public getDocumentTimeManager(): MMLDocumentTimeManager {
    return this.documentTimeManager;
  }

  public connectedCallback(): void {
    this.style.display = "none";
    if (!this.isConnected) {
      return;
    }

    super.connectedCallback();

    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    if (!graphicsAdapter || this.remoteDocumentGraphics) {
      return;
    }

    this.remoteDocumentGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .RemoteDocumentGraphicsInterface(this);
    this.animationFrameCallback = window.requestAnimationFrame(() => {
      this.tick();
    });
  }

  public disconnectedCallback() {
    if (this.animationFrameCallback) {
      window.cancelAnimationFrame(this.animationFrameCallback);
      this.animationFrameCallback = null;
    }
    this.remoteDocumentGraphics?.dispose();
    this.remoteDocumentGraphics = null;
    super.disconnectedCallback();
  }

  public dispatchEvent(event: CustomEvent): boolean {
    if (this.contains(event.detail.element)) {
      return HTMLElement.prototype.dispatchEvent.call(this, event);
    } else {
      return false;
    }
  }

  public init(mmlScene: IMMLScene<G>, documentAddress: string) {
    if (this.scene) {
      throw new Error("Scene already set");
    }
    this.scene = mmlScene;
    this.documentAddress = documentAddress;
    this.connectedCallback();
  }

  public getDocumentAddress(): string | null {
    return this.documentAddress;
  }

  public getMMLScene(): IMMLScene<G> {
    if (!this.scene) {
      throw new Error("Scene not set");
    }
    return this.scene;
  }

  public tick() {
    this.documentTimeManager.tick();
    this.animationFrameCallback = window.requestAnimationFrame(() => {
      this.tick();
    });
  }
}
