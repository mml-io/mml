import * as playcanvas from "playcanvas";

import { Cylinder, MCylinderProps, MELEMENT_PROPERTY_NAME } from "../elements";
import { CylinderGraphics, MMLColor } from "../MMLGraphicsInterface";

export class PlayCanvasCylinder extends CylinderGraphics {
  private entity: playcanvas.Entity;
  private modelComponent: playcanvas.ModelComponent;
  private collisionComponent: playcanvas.CollisionComponent;
  private material: playcanvas.StandardMaterial = new playcanvas.StandardMaterial();

  constructor(private cylinder: Cylinder) {
    super(cylinder);

    /*
     The primitive must be in an internal entity to allow using setLocalScale
     without affecting children.
    */
    this.entity = new playcanvas.Entity("cylinder-internal");
    (this.entity as any)[MELEMENT_PROPERTY_NAME] = cylinder;
    this.modelComponent = this.entity.addComponent("render", {
      type: "cylinder",
      material: this.material,
    })! as playcanvas.ModelComponent;
    this.collisionComponent = this.entity.addComponent("collision", {
      type: "cylinder",
    });
    this.collisionComponent.radius = 0.5;
    this.collisionComponent.height = 1;
    cylinder.getContainer().addChild(this.entity);
  }

  disable(): void {}

  enable(): void {}

  setColor(color: MMLColor, mCylinderProps: MCylinderProps): void {
    this.material.diffuse.set(color.r, color.g, color.b);
    this.material.metalness = 0;
    this.material.useMetalness = true;
    this.material.update();
  }

  private updateSize(mCylinderProps: MCylinderProps): void {
    this.entity.setLocalScale(mCylinderProps.radius, mCylinderProps.height, mCylinderProps.radius);
    this.collisionComponent.radius = mCylinderProps.radius / 2;
    this.collisionComponent.height = mCylinderProps.height;
    this.collisionComponent.onSetHalfExtents();
  }

  setRadius(radius: number, mCylinderProps: MCylinderProps): void {
    this.updateSize(mCylinderProps);
  }

  setHeight(height: number, mCylinderProps: MCylinderProps): void {
    this.updateSize(mCylinderProps);
  }

  setCastShadows(castShadows: boolean, mCylinderProps: MCylinderProps): void {
    this.modelComponent.castShadows = castShadows;
  }

  setOpacity(opacity: number, mCylinderProps: MCylinderProps): void {
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
