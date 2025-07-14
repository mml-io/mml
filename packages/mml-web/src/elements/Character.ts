import { GraphicsAdapter } from "../graphics";
import { Model } from "./Model";

export class Character<G extends GraphicsAdapter = GraphicsAdapter> extends Model<G> {
  static tagName = "m-character";

  static get observedAttributes(): Array<string> {
    return [...Model.observedAttributes];
  }

  constructor() {
    super();
  }

  public parentTransformed(): void {
    super.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  public connectedCallback() {
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }
}
