import { TransformableElement } from "./TransformableElement";
import { AttributeHandler } from "../utils/attribute-handling";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

export class Prompt extends TransformableElement {
  static tagName = "m-prompt";

  private abortController: AbortController | null = null;

  private props = {
    message: undefined as string | undefined,
    placeholder: undefined as string | undefined,
    prefill: undefined as string | undefined,
  };

  private static attributeHandler = new AttributeHandler<Prompt>({
    message: (instance, newValue) => {
      instance.props.message = newValue !== null ? newValue : undefined;
    },
    placeholder: (instance, newValue) => {
      instance.props.placeholder = newValue !== null ? newValue : undefined;
    },
    prefill: (instance, newValue) => {
      instance.props.prefill = newValue !== null ? newValue : undefined;
    },
  });

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes, ...Prompt.attributeHandler.getAttributes()];
  }

  constructor() {
    super();

    this.addEventListener("click", () => {
      this.trigger();
    });
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

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Prompt.attributeHandler.handle(this, name, newValue);
  }

  private trigger(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.abortController = new AbortController();
    this.getScene().prompt(this.props, this.abortController.signal, (result) => {
      if (!this.isConnected) {
        return;
      }
      if (result !== null) {
        this.dispatchEvent(
          new CustomEvent("prompt", { bubbles: false, detail: { value: result } }),
        );
      }
    });
  }
}
