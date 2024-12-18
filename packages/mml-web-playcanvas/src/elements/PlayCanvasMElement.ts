import { MElement, MELEMENT_PROPERTY_NAME } from "@mml-io/mml-web";
import { MElementGraphics } from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

export class PlayCanvasMElement extends MElementGraphics<PlayCanvasGraphicsAdapter> {
  protected container: playcanvas.Entity;
  private currentParentContainer: playcanvas.Entity | null = null;

  constructor(private element: MElement<PlayCanvasGraphicsAdapter>) {
    super(element);
    this.container = new playcanvas.Entity(
      element.constructor.name,
      element.getScene().getGraphicsAdapter().getPlayCanvasApp(),
    );
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

    this.container.destroy();
  }
}
