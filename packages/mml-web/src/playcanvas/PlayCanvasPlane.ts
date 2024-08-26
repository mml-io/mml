import * as playcanvas from "playcanvas";

import { MELEMENT_PROPERTY_NAME, MPlaneProps, Plane } from "../elements";
import { MMLColor, PlaneGraphics } from "../MMLGraphicsInterface";

export class PlayCanvasPlane extends PlaneGraphics {
  private entity: playcanvas.Entity;
  private modelComponent: playcanvas.ModelComponent;
  private collisionComponent: playcanvas.CollisionComponent;
  private material: playcanvas.StandardMaterial = new playcanvas.StandardMaterial();

  constructor(private plane: Plane) {
    super(plane);

    /*
     The primitive must be in an internal entity to allow using setLocalScale
     without affecting children.
    */
    this.entity = new playcanvas.Entity("plane-internal");
    (this.entity as any)[MELEMENT_PROPERTY_NAME] = plane;
    this.modelComponent = this.entity.addComponent("render", {
      type: "plane",
      material: this.material,
    })! as playcanvas.ModelComponent;
    this.entity.rotate(90, 0, 0);
    this.collisionComponent = this.entity.addComponent("collision", {
      type: "box",
      halfExtents: new playcanvas.Vec3(0.5, 0, 0.5),
    });
    plane.getContainer().addChild(this.entity);
  }

  disable(): void {}

  enable(): void {}

  setColor(color: MMLColor, mPlaneProps: MPlaneProps): void {
    this.material.diffuse.set(color.r, color.g, color.b);
    this.material.metalness = 0;
    this.material.useMetalness = true;
    this.material.update();
  }

  private updateSize(mPlaneProps: MPlaneProps): void {
    this.entity.setLocalScale(mPlaneProps.width, mPlaneProps.height, 1);
    this.collisionComponent.halfExtents.set(mPlaneProps.width / 2, 0, mPlaneProps.height / 2);
    this.collisionComponent.onSetHalfExtents();
  }

  setWidth(width: number, mPlaneProps: MPlaneProps): void {
    this.updateSize(mPlaneProps);
  }

  setHeight(height: number, mPlaneProps: MPlaneProps): void {
    this.updateSize(mPlaneProps);
  }

  setCastShadows(castShadows: boolean, mPlaneProps: MPlaneProps): void {
    this.modelComponent.castShadows = castShadows;
  }

  setOpacity(opacity: number, mPlaneProps: MPlaneProps): void {
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
