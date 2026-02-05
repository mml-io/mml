import { MELEMENT_PROPERTY_NAME, MPlaneProps, Plane } from "@mml-io/mml-web";
import { MMLColor } from "@mml-io/mml-web";
import { PlaneGraphics } from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

export class PlayCanvasPlane extends PlaneGraphics<PlayCanvasGraphicsAdapter> {
  private entity: playcanvas.Entity;
  private renderComponent: playcanvas.RenderComponent;
  private material: playcanvas.StandardMaterial = new playcanvas.StandardMaterial();

  constructor(private plane: Plane<PlayCanvasGraphicsAdapter>) {
    super(plane);

    /*
     The primitive must be in an internal entity to allow using setLocalScale
     without affecting children.
    */
    this.entity = new playcanvas.Entity(
      "plane-internal",
      plane.getScene().getGraphicsAdapter().getPlayCanvasApp(),
    );
    (this.entity as any)[MELEMENT_PROPERTY_NAME] = plane;
    this.renderComponent = this.entity.addComponent("render", {
      type: "plane",
      material: this.material,
    }) as playcanvas.RenderComponent;
    this.entity.rotate(90, 0, 0);
    this.entity.addComponent("collision", {
      type: "box",
      halfExtents: new playcanvas.Vec3(0.5, 0, 0.5),
    });
    plane.getContainer().addChild(this.entity);
  }

  disable(): void {}

  enable(): void {}

  getCollisionElement(): playcanvas.Entity {
    return this.entity;
  }

  setColor(color: MMLColor): void {
    this.material.diffuse.set(color.r, color.g, color.b);
    this.material.update();
  }

  private updateSize(mPlaneProps: MPlaneProps): void {
    this.entity.setLocalScale(mPlaneProps.width, 1, mPlaneProps.height);
    if (this.entity.collision) {
      this.entity.collision.halfExtents.set(mPlaneProps.width / 2, 0, mPlaneProps.height / 2);
      // @ts-expect-error - accessing onSetHalfExtents private method
      this.entity.collision.onSetHalfExtents();
    }
  }

  setWidth(width: number, mPlaneProps: MPlaneProps): void {
    this.updateSize(mPlaneProps);
  }

  setHeight(height: number, mPlaneProps: MPlaneProps): void {
    this.updateSize(mPlaneProps);
  }

  setCastShadows(castShadows: boolean): void {
    // TODO - not casting shadows?
    this.renderComponent.castShadows = castShadows;
  }

  setOpacity(opacity: number): void {
    if (opacity === 1) {
      this.material.blendType = playcanvas.BLEND_NONE;
    } else {
      this.material.blendType = playcanvas.BLEND_NORMAL;
    }
    this.material.opacity = opacity;
    this.material.update();
  }

  dispose() {
    this.entity.destroy();
  }
}
