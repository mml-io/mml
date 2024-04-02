import { MElement } from "./MElement";
import { MMLDocumentTimeManager } from "../MMLDocumentTimeManager";
import { IMMLScene } from "../MMLScene";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

export class RemoteDocument extends MElement {
  static tagName = "m-remote-document";

  private scene: IMMLScene | null = null;
  private documentAddress: string | null = null;
  private documentTimeManager: MMLDocumentTimeManager;
  private animationFrameCallback: number | null = null;

  constructor() {
    super();
    this.documentTimeManager = new MMLDocumentTimeManager();
  }

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return null;
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return false;
  }

  getDocumentTimeManager(): MMLDocumentTimeManager {
    return this.documentTimeManager;
  }

  connectedCallback() {
    this.style.display = "none";
    this.animationFrameCallback = window.requestAnimationFrame(() => {
      this.tick();
    });
    super.connectedCallback();
  }

  dispatchEvent(event: CustomEvent): boolean {
    if (this.contains(event.detail.element)) {
      return HTMLElement.prototype.dispatchEvent.call(this, event);
    } else {
      return false;
    }
  }

  disconnectedCallback() {
    if (this.animationFrameCallback) {
      window.cancelAnimationFrame(this.animationFrameCallback);
      this.animationFrameCallback = null;
    }
    super.disconnectedCallback();
  }

  init(mmlScene: IMMLScene, documentAddress: string) {
    if (this.scene) {
      throw new Error("Scene already set");
    }
    this.scene = mmlScene;
    this.documentAddress = documentAddress;
    this.scene.getRootContainer().add(this.container);
  }

  public getDocumentAddress(): string | null {
    return this.documentAddress;
  }

  getMMLScene(): IMMLScene {
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
