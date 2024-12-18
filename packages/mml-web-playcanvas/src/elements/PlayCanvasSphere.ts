import { MELEMENT_PROPERTY_NAME, MSphereProps, Sphere } from "@mml-io/mml-web";
import { MMLColor } from "@mml-io/mml-web";
import { SphereGraphics } from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

export class PlayCanvasSphere extends SphereGraphics<PlayCanvasGraphicsAdapter> {
  private entity: playcanvas.Entity;
  private renderComponent: playcanvas.RenderComponent;
  private material: playcanvas.StandardMaterial = new playcanvas.StandardMaterial();

  constructor(private sphere: Sphere<PlayCanvasGraphicsAdapter>) {
    super(sphere);

    /*
     The primitive must be in an internal entity to allow using setLocalScale
     without affecting children.
    */
    this.entity = new playcanvas.Entity(
      "sphere-internal",
      sphere.getScene().getGraphicsAdapter().getPlayCanvasApp(),
    );
    (this.entity as any)[MELEMENT_PROPERTY_NAME] = sphere;
    this.renderComponent = this.entity.addComponent("render", {
      type: "sphere",
      material: this.material,
    }) as playcanvas.RenderComponent;
    this.entity.addComponent("collision", {
      type: "sphere",
    });
    if (this.entity.collision) {
      this.entity.collision.radius = 1;
    }
    sphere.getContainer().addChild(this.entity);
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

  private updateSize(mSphereProps: MSphereProps): void {
    this.entity.setLocalScale(
      mSphereProps.radius * 2,
      mSphereProps.radius * 2,
      mSphereProps.radius * 2,
    );
    if (this.entity.collision) {
      this.entity.collision.radius = mSphereProps.radius;
      // @ts-expect-error - accessing onSetRadius private method
      this.entity.collision.onSetRadius();
    }
  }

  setRadius(radius: number, mSphereProps: MSphereProps): void {
    this.updateSize(mSphereProps);
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
