import * as playcanvas from "playcanvas";

import { MELEMENT_PROPERTY_NAME, MSphereProps, Sphere } from "../elements";
import { MMLColor, SphereGraphics } from "../MMLGraphicsInterface";

export class PlayCanvasSphere extends SphereGraphics {
  private entity: playcanvas.Entity;
  private modelComponent: playcanvas.ModelComponent;
  private collisionComponent: playcanvas.CollisionComponent;
  private material: playcanvas.StandardMaterial = new playcanvas.StandardMaterial();

  constructor(private sphere: Sphere) {
    super(sphere);

    /*
     The primitive must be in an internal entity to allow using setLocalScale
     without affecting children.
    */
    this.entity = new playcanvas.Entity("sphere-internal");
    (this.entity as any)[MELEMENT_PROPERTY_NAME] = sphere;
    this.modelComponent = this.entity.addComponent("render", {
      type: "sphere",
      material: this.material,
    })! as playcanvas.ModelComponent;
    this.collisionComponent = this.entity.addComponent("collision", {
      type: "sphere",
    });
    this.collisionComponent.radius = 1;
    sphere.getContainer().addChild(this.entity);
  }

  disable(): void {}

  enable(): void {}

  setColor(color: MMLColor, mSphereProps: MSphereProps): void {
    this.material.diffuse.set(color.r, color.g, color.b);
    this.material.metalness = 0;
    this.material.useMetalness = true;
    this.material.update();
  }

  private updateSize(mSphereProps: MSphereProps): void {
    this.entity.setLocalScale(mSphereProps.radius, mSphereProps.radius, mSphereProps.radius);
    this.collisionComponent.radius = mSphereProps.radius / 2;
    this.collisionComponent.onSetHalfExtents();
  }

  setRadius(radius: number, mSphereProps: MSphereProps): void {
    this.updateSize(mSphereProps);
  }

  setCastShadows(castShadows: boolean, mSphereProps: MSphereProps): void {
    this.modelComponent.castShadows = castShadows;
  }

  setOpacity(opacity: number, mSphereProps: MSphereProps): void {
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
