import { TransformableElement } from "./TransformableElement";
import { AttributeHandler } from "../utils/attribute-handling";
import { StaticHTMLFrameInstance } from "../utils/frame/StaticHTMLFrameInstance";
import { WebSocketFrameInstance } from "../utils/frame/WebSocketFrameInstance";

export class Frame extends TransformableElement {
  static tagName = "m-frame";

  private static attributeHandler = new AttributeHandler<Frame>({
    src: (instance, newValue) => {
      instance.src = newValue;
      if (instance.frameContentsInstance) {
        instance.disposeInstance();
      }
      if (instance.src && instance.isConnected) {
        instance.createFrameContentsInstance(instance.src);
      }
    },
  });

  private frameContentsInstance: WebSocketFrameInstance | StaticHTMLFrameInstance | null = null;
  private src: string | null = null;

  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes, ...Frame.attributeHandler.getAttributes()];
  }

  constructor() {
    super();
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return true;
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.src) {
      this.createFrameContentsInstance(this.src);
    }
  }

  private createFrameContentsInstance(src: string) {
    if (this.frameContentsInstance) {
      // TODO - avoid calling this if the instance already exists - this is a hack to avoid duplicating frames
      if (this.frameContentsInstance.src !== src) {
        console.error("Instance already existed with a different src");
        this.disposeInstance();
      } else {
        return;
      }
    }

    if (src.startsWith("ws://") || src.startsWith("wss://")) {
      this.frameContentsInstance = new WebSocketFrameInstance(this, src, this.getScene());
    } else {
      this.frameContentsInstance = new StaticHTMLFrameInstance(this, src, this.getScene());
    }
    this.container.add(this.frameContentsInstance.container);
  }

  private disposeInstance() {
    if (this.frameContentsInstance !== null) {
      this.container.remove(this.frameContentsInstance.container);
      this.frameContentsInstance.dispose();
      this.frameContentsInstance = null;
    }
  }

  disconnectedCallback() {
    this.disposeInstance();
    super.disconnectedCallback();
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Frame.attributeHandler.handle(this, name, newValue);
  }
}
