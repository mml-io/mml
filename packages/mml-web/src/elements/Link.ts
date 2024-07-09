import { TransformableElement } from "./TransformableElement";
import { AttributeHandler } from "../utils/attribute-handling";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

export class Link extends TransformableElement {
  static tagName = "m-link";

  private abortController: AbortController | null = null;

  private props = {
    href: undefined as string | undefined,
  };

  private static attributeHandler = new AttributeHandler<Link>({
    href: (instance, newValue) => {
      instance.props.href = newValue !== null ? newValue : undefined;
    },
  });

  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes, ...Link.attributeHandler.getAttributes()];
  }

  constructor() {
    super();

    this.addEventListener("click", () => {
      if (this.props.href) {
        if (this.abortController) {
          this.abortController.abort();
          this.abortController = null;
        }
        this.abortController = new AbortController();
        this.getScene().link(
          { href: this.props.href, popup: false },
          this.abortController.signal,
          () => {
            this.abortController = null;
          },
        );
      }
    });
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return false;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Link.attributeHandler.handle(this, name, newValue);
  }

  protected disable(): void {
    // no-op
  }

  protected enable(): void {
    // no-op
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return null;
  }
}
