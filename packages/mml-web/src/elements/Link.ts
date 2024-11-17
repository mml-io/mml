import { AttributeHandler } from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { GraphicsAdapter } from "../graphics";
import { TransformableElement } from "./TransformableElement";

export class Link<G extends GraphicsAdapter = GraphicsAdapter> extends TransformableElement<G> {
  static tagName = "m-link";

  private abortController: AbortController | null = null;

  private props = {
    href: undefined as string | undefined,
    target: undefined as string | undefined,
  };

  private static attributeHandler = new AttributeHandler<Link<GraphicsAdapter>>({
    href: (instance, newValue) => {
      instance.props.href = newValue !== null ? newValue : undefined;
    },
    target: (instance, newValue) => {
      instance.props.target = newValue !== null ? newValue : undefined;
    },
  });

  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes, ...Link.attributeHandler.getAttributes()];
  }

  /*
   This is a simple check to ensure that the href is an acceptable URL and is
   not a "javascript:alert('foo')" URL or something other than a navigable URL.
  */
  static isAcceptableHref(href: string): boolean {
    const url = new URL(href, window.location.href);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return true;
    }
    return false;
  }

  constructor() {
    super();

    this.addEventListener("click", () => {
      if (this.props.href) {
        const href = this.props.href;
        if (!Link.isAcceptableHref(href)) {
          console.warn(
            `Refusing to navigate to ${href} as it does not meet the acceptable href criteria.`,
          );
          return;
        }

        if (this.abortController) {
          this.abortController.abort();
          this.abortController = null;
        }
        this.abortController = new AbortController();
        this.getScene().link(
          { href, target: this.props.target, popup: false },
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

  public getContentBounds(): OrientedBoundingBox | null {
    return null;
  }
}
