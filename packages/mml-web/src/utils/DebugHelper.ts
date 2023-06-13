import * as THREE from "three";

import { parseBoolAttribute } from "./attribute-handling";
import { MElement } from "../elements";

const debugAttributeName = "debug";

export class DebugHelper {
  static observedAttributes = [debugAttributeName];
  private element: MElement;

  constructor(element: MElement) {
    this.element = element;
  }

  private debugAxes: THREE.AxesHelper | null = null;

  public handle(name: string, newValue: string) {
    if (name === debugAttributeName) {
      if (parseBoolAttribute(newValue, false)) {
        if (!this.debugAxes) {
          this.debugAxes = new THREE.AxesHelper(1);
          this.element.getContainer().add(this.debugAxes);
        }
      } else {
        if (this.debugAxes) {
          this.element.getContainer().remove(this.debugAxes);
          this.debugAxes = null;
        }
      }
    }
  }
}
