import { MElement } from "./MElement";
import { documentTimeChangedEventName } from "../common";
import { IMMLScene } from "../MMLScene";

export class RemoteDocument extends MElement {
  static tagName = "m-remote-document";

  private scene: IMMLScene | null = null;
  private relativeDocumentStartTime: number | null = null;
  private documentAddress: string | null = null;

  constructor() {
    super();
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return false;
  }

  getDocumentTime(): number | null {
    if (this.relativeDocumentStartTime === null) {
      return null;
    }
    return Date.now() - this.relativeDocumentStartTime;
  }

  setDocumentTime(documentTime: number) {
    this.relativeDocumentStartTime = Date.now() - documentTime;

    // Use the super class' dispatchEvent method to avoid triggering remote event dispatching
    HTMLElement.prototype.dispatchEvent.call(
      this,
      new CustomEvent(documentTimeChangedEventName, { detail: documentTime }),
    );
  }

  connectedCallback() {
    this.style.display = "none";
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
}
