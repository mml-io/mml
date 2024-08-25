import * as playcanvas from "playcanvas";

import { Model } from "./Model";

export class Character extends Model {
  static tagName = "m-character";

  static get observedAttributes(): Array<string> {
    return [...Model.observedAttributes];
  }

  constructor() {
    super();
  }

  public getCharacter(): playcanvas.Entity | null {
    return this.loadedState?.group || null;
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return true;
  }

  connectedCallback() {
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }
}
