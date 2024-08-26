import * as THREE from "three";

import { DebugHelperGraphics } from "../MMLGraphicsInterface";
import { DebugHelper } from "../utils/DebugHelper";

export class ThreeJSDebugHelper extends DebugHelperGraphics {
  private debugAxes: THREE.AxesHelper | null = null;

  constructor(private debugHelper: DebugHelper) {
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
