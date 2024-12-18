import { Cylinder, MCylinderProps, MELEMENT_PROPERTY_NAME } from "@mml-io/mml-web";
import { CylinderGraphics } from "@mml-io/mml-web";
import { MMLColor } from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

export class PlayCanvasCylinder extends CylinderGraphics<PlayCanvasGraphicsAdapter> {
  private entity: playcanvas.Entity;
  private renderComponent: playcanvas.RenderComponent;
  private material: playcanvas.StandardMaterial = new playcanvas.StandardMaterial();

  constructor(private cylinder: Cylinder<PlayCanvasGraphicsAdapter>) {
    super(cylinder);

    /*
     The primitive must be in an internal entity to allow using setLocalScale
     without affecting children.
    */
    this.entity = new playcanvas.Entity(
      "cylinder-internal",
      cylinder.getScene().getGraphicsAdapter().getPlayCanvasApp(),
    );
    (this.entity as any)[MELEMENT_PROPERTY_NAME] = cylinder;
    this.renderComponent = this.entity.addComponent("render", {
      type: "cylinder",
      material: this.material,
    }) as playcanvas.RenderComponent;
    const collisionComponent = this.entity.addComponent("collision", {
      type: "cylinder",
    }) as playcanvas.CollisionComponent;
    collisionComponent.radius = 0.5;
    collisionComponent.height = 1;
    cylinder.getContainer().addChild(this.entity);
  }

  disable(): void {}

  enable(): void {}

  getCollisionElement(): playcanvas.Entity {
    return this.entity;
  }

  setColor(color: MMLColor): void {
    this.material.diffuse.set(color.r, color.g, color.b);
    this.material.metalness = 0;
    this.material.useMetalness = true;
    this.material.update();
  }

  private updateSize(mCylinderProps: MCylinderProps): void {
    this.entity.setLocalScale(
      mCylinderProps.radius * 2,
      mCylinderProps.height,
      mCylinderProps.radius * 2,
    );
    if (this.entity.collision) {
      this.entity.collision.radius = mCylinderProps.radius;
      this.entity.collision.height = mCylinderProps.height;
      // @ts-expect-error - accessing onSetHalfExtents private method
      this.entity.collision.onSetHalfExtents();
    }
  }

  setRadius(radius: number, mCylinderProps: MCylinderProps): void {
    this.updateSize(mCylinderProps);
  }

  setHeight(height: number, mCylinderProps: MCylinderProps): void {
    this.updateSize(mCylinderProps);
  }

  setCastShadows(castShadows: boolean): void {
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
