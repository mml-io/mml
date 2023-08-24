import { MElement } from "./MElement";
import { MMLDocumentRoot } from "../MMLDocumentRoot";
import { IMMLScene } from "../MMLScene";

export class RemoteDocument extends MElement {
  static tagName = "m-remote-document";

  private scene: IMMLScene | null = null;
  private documentAddress: string | null = null;
  private documentRoot: MMLDocumentRoot;
  private animationFrameCallback: number | null = null;

  constructor() {
    super();
    this.documentRoot = new MMLDocumentRoot(this);
  }

  public addDocumentTimeListenerCallback(cb: (time: number) => void) {
    this.documentRoot.addDocumentTimeListenerCallback(cb);
  }

  public removeDocumentTimeListenerCallback(cb: (time: number) => void) {
    this.documentRoot.removeDocumentTimeListenerCallback(cb);
  }

  public addDocumentTimeTickListenerCallback(cb: (time: number) => void) {
    this.documentRoot.addDocumentTimeTickListenerCallback(cb);
  }

  public removeDocumentTimeTickListenerCallback(cb: (time: number) => void) {
    this.documentRoot.removeDocumentTimeTickListenerCallback(cb);
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return false;
  }

  getDocumentTime(): number | null {
    return this.documentRoot.getDocumentTime();
  }

  setDocumentTime(documentTime: number) {
    this.documentRoot.setDocumentTime(documentTime);
  }

  overrideDocumentTime(documentTime: number) {
    this.documentRoot.overrideDocumentTime(documentTime);
  }

  connectedCallback() {
    this.style.display = "none";
    this.animationFrameCallback = window.requestAnimationFrame(() => {
      this.tick();
    });
  }

  dispatchEvent(event: CustomEvent): boolean {
    if (this.contains(event.detail.element)) {
      return HTMLElement.prototype.dispatchEvent.call(this, event);
    } else {
      return false;
    }
  }

  disconnectedCallback() {
    // no-op to avoid calling super class
    if (this.animationFrameCallback) {
      window.cancelAnimationFrame(this.animationFrameCallback);
      this.animationFrameCallback = null;
    }
  }

  init(mScene: IMMLScene, documentAddress: string) {
    if (this.scene) {
      throw new Error("Scene already set");
    }
    this.scene = mScene;
    this.documentAddress = documentAddress;
    this.scene.getRootContainer().add(this.container);
  }

  public getDocumentAddress(): string | null {
    return this.documentAddress;
  }

  getMScene(): IMMLScene {
    if (!this.scene) {
      throw new Error("Scene not set");
    }
    return this.scene;
  }

  private tick() {
    this.documentRoot.tick();
    this.animationFrameCallback = window.requestAnimationFrame(() => {
      this.tick();
    });
  }
}
