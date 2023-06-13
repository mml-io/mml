import { TransformableElement } from "./TransformableElement";

export class Group extends TransformableElement {
  static tagName = "m-group";
  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes];
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

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
  }
}
