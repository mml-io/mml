import { AttributeHandler } from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { GraphicsAdapter, LinkGraphics } from "../graphics";
import { TransformableElement } from "./TransformableElement";

export type MLinkProps = {
  href: string | null;
  target: string | null;
};

export class Link<G extends GraphicsAdapter = GraphicsAdapter> extends TransformableElement<G> {
  static tagName = "m-link";
  private linkGraphics: LinkGraphics<G> | null;

  private abortController: AbortController | null = null;

  public props: MLinkProps = {
    href: null,
    target: null,
  };

  private static attributeHandler = new AttributeHandler<Link<GraphicsAdapter>>({
    href: (instance, newValue) => {
      instance.props.href = newValue !== null ? newValue : null;
    },
    target: (instance, newValue) => {
      instance.props.target = newValue !== null ? newValue : null;
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
          { href, target: this.props.target ?? undefined, popup: false },
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

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.transformableElementGraphics) {
      return;
    }
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

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.linkGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();

    this.linkGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLLinkGraphicsInterface(this);

    for (const name of Link.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }

  public disconnectedCallback(): void {
    this.linkGraphics?.dispose();
    this.linkGraphics = null;
    super.disconnectedCallback();
  }
}
