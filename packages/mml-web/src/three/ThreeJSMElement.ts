import * as THREE from "three";

import { MElement, MELEMENT_PROPERTY_NAME } from "../elements";
import { MElementGraphics } from "../MMLGraphicsInterface";

export class ThreeJSMElement extends MElementGraphics<THREE.Group> {
  protected container: THREE.Group;
  private currentParentContainer: THREE.Group | null = null;

  constructor(private element: MElement) {
    super(element);
    this.container = new THREE.Group();
    this.container.name = this.constructor.name;
    (this.container as any)[MELEMENT_PROPERTY_NAME] = element;

    if (this.currentParentContainer !== null) {
      throw new Error("Already connected to a parent");
    }

    const mElementParent = this.element.getMElementParent();
    if (mElementParent) {
      this.currentParentContainer = mElementParent.getContainer();
      this.currentParentContainer.add(this.container);
      return;
    }

    // If none of the ancestors are MElements then this element may be directly connected to the body (without a wrapper).
    // Attempt to use a global scene that has been configured to attach this element to.
    const scene = this.element.getScene();
    this.currentParentContainer = scene.getRootContainer();
    this.currentParentContainer.add(this.container);
  }

  public getContainer(): THREE.Group {
    return this.container;
  }

  public dispose() {
    if (this.currentParentContainer === null) {
      throw new Error("Was not connected to a parent");
    }

    this.currentParentContainer.remove(this.container);
    this.currentParentContainer = null;
  }
}
