import { OrientedBoundingBox } from "../bounding-box";
import { GraphicsAdapter } from "../graphics";
import { TransformableElement } from "./TransformableElement";

export class Group<G extends GraphicsAdapter = GraphicsAdapter> extends TransformableElement<G> {
  static tagName = "m-group";
  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes];
  }

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  constructor() {
    super();
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
    if (!this.transformableElementGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
  }

  connectedCallback() {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter()) {
      return;
    }

    for (const name of Group.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }
}
