import { DebugHelper, DebugHelperGraphics } from "mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export class ThreeJSDebugHelper extends DebugHelperGraphics<ThreeJSGraphicsAdapter> {
  private debugAxes: THREE.AxesHelper | null = null;

  constructor(private debugHelper: DebugHelper<ThreeJSGraphicsAdapter>) {
    super(debugHelper);
    this.debugAxes = new THREE.AxesHelper(1);
    this.debugHelper.getContainer().add(this.debugAxes);
  }

  dispose() {
    if (this.debugAxes) {
      this.debugHelper.getContainer().remove(this.debugAxes);
    }
    this.debugAxes = null;
  }
}
