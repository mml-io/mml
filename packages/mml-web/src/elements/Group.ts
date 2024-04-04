import { TransformableElement } from "./TransformableElement";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

export class Group extends TransformableElement {
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

  protected getContentBounds(): OrientedBoundingBox | null {
    return null;
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return true;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
  }
}
