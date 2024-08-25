import * as playcanvas from "playcanvas";

import { MElement, MELEMENT_PROPERTY_NAME } from "../elements";
import { MElementGraphics } from "../MMLGraphicsInterface";

export class PlayCanvasMElement extends MElementGraphics<playcanvas.Entity> {
  protected container: playcanvas.Entity;
  private currentParentContainer: playcanvas.Entity | null = null;

  constructor(private element: MElement) {
    super(element);
    console.log("element.constructor.name", element.constructor.tagName);
    this.container = new playcanvas.Entity(element.constructor.tagName);
    (this.container as any)[MELEMENT_PROPERTY_NAME] = element;

    if (this.currentParentContainer !== null) {
      throw new Error("Already connected to a parent");
    }

    const mElementParent = this.element.getMElementParent();
    if (mElementParent) {
      this.currentParentContainer = mElementParent.getContainer();
      this.currentParentContainer.addChild(this.container);
      return;
    }

    // If none of the ancestors are MElements then this element may be directly connected to the body (without a wrapper).
    // Attempt to use a global scene that has been configured to attach this element to.
    const scene = this.element.getScene();
    this.currentParentContainer = scene.getRootContainer();
    this.currentParentContainer.addChild(this.container);
  }

  public getContainer(): playcanvas.Entity {
    return this.container;
  }

  public dispose() {
    if (this.currentParentContainer === null) {
      throw new Error("Was not connected to a parent");
    }

    this.currentParentContainer.removeChild(this.container);
    this.currentParentContainer = null;
  }
}
