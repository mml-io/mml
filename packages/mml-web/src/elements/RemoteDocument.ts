import { OrientedBoundingBox } from "../bounding-box";
import { GraphicsAdapter } from "../graphics";
import { RemoteDocumentGraphics } from "../graphics";
import { IMMLScene } from "../scene";
import { MMLDocumentTimeManager } from "../time";
import { consumeEventEventName } from "./MElement";
import { TransformableElement } from "./TransformableElement";

export class RemoteDocument<
  G extends GraphicsAdapter = GraphicsAdapter,
> extends TransformableElement<G> {
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

    if (!this.getScene().hasGraphicsAdapter() || this.remoteDocumentGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();

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
    return HTMLElement.prototype.dispatchEvent.call(this, event);
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

  public getMMLScene(): IMMLScene<G> | null {
    if (!this.scene) {
      return null;
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
