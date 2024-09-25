import { MElement, MELEMENT_PROPERTY_NAME } from "mml-web";
import { MElementGraphics } from "mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export class ThreeJSMElement extends MElementGraphics<ThreeJSGraphicsAdapter> {
  protected container: THREE.Object3D;
  private currentParentContainer: THREE.Object3D | null = null;

  constructor(private element: MElement<ThreeJSGraphicsAdapter>) {
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

  public getContainer(): THREE.Object3D {
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
