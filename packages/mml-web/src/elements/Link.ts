import { TransformableElement } from "./TransformableElement";
import { AttributeHandler } from "../utils/attribute-handling";

export class Link extends TransformableElement {
  static tagName = "m-link";

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
        this.getScene().link(this.props.href);
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
}
