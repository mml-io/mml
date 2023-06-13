import * as THREE from "three";

import { Model } from "./Model";

export class Character extends Model {
  static tagName = "m-character";

  static get observedAttributes(): Array<string> {
    return [...Model.observedAttributes];
  }

  constructor() {
    super();
  }

  public getCharacter(): THREE.Object3D | null {
    return this.gltfScene;
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
