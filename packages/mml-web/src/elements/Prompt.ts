import { AttributeHandler } from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { GraphicsAdapter, PromptGraphics } from "../graphics";
import { TransformableElement } from "./TransformableElement";

export type MPromptProps = {
  message: string | undefined;
  placeholder: string | undefined;
  prefill: string | undefined;
};

export class Prompt<G extends GraphicsAdapter = GraphicsAdapter> extends TransformableElement<G> {
  static tagName = "m-prompt";
  private promptGraphics: PromptGraphics<G> | null;

  private abortController: AbortController | null = null;

  public props: MPromptProps = {
    message: undefined as string | undefined,
    placeholder: undefined as string | undefined,
    prefill: undefined as string | undefined,
  };

  private static attributeHandler = new AttributeHandler<Prompt<GraphicsAdapter>>({
    message: (instance, newValue) => {
      instance.props.message = newValue !== null ? newValue : undefined;
      instance.promptGraphics?.setMessage(instance.props.message, instance.props);
    },
    placeholder: (instance, newValue) => {
      instance.props.placeholder = newValue !== null ? newValue : undefined;
      instance.promptGraphics?.setPlaceholder(instance.props.placeholder, instance.props);
    },
    prefill: (instance, newValue) => {
      instance.props.prefill = newValue !== null ? newValue : undefined;
      instance.promptGraphics?.setPrefill(instance.props.prefill, instance.props);
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

  public getContentBounds(): OrientedBoundingBox | null {
    return null;
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return false;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.promptGraphics) {
      return;
    }
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

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.promptGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();

    this.promptGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLPromptGraphicsInterface(this);

    for (const name of Prompt.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }

  public disconnectedCallback(): void {
    this.promptGraphics?.dispose();
    this.promptGraphics = null;
    super.disconnectedCallback();
  }
}
