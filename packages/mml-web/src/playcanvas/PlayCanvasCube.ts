import * as playcanvas from "playcanvas";

import { Cube, MCubeProps, MELEMENT_PROPERTY_NAME } from "../elements";
import { CubeGraphics, MMLColor } from "../MMLGraphicsInterface";

export class PlayCanvasCube extends CubeGraphics {
  private entity: playcanvas.Entity;
  private modelComponent: playcanvas.ModelComponent;
  private collisionComponent: playcanvas.CollisionComponent;
  private material: playcanvas.StandardMaterial = new playcanvas.StandardMaterial();

  constructor(private cube: Cube) {
    super(cube);

    /*
     The primitive must be in an internal entity to allow using setLocalScale
     without affecting children.
    */
    this.entity = new playcanvas.Entity("cube-internal");
    (this.entity as any)[MELEMENT_PROPERTY_NAME] = cube;
    this.modelComponent = this.entity.addComponent("render", {
      type: "box",
      material: this.material,
    })! as playcanvas.ModelComponent;
    this.collisionComponent = this.entity.addComponent("collision", {
      type: "box",
      halfExtents: new playcanvas.Vec3(0.5, 0.5, 0.5),
    });
    cube.getContainer().addChild(this.entity);
  }

  disable(): void {}

  enable(): void {}

  setColor(color: MMLColor, mCubeProps: MCubeProps): void {
    this.material.diffuse.set(color.r, color.g, color.b);
    this.material.metalness = 0;
    this.material.useMetalness = true;
    this.material.update();
  }

  private updateSize(mCubeProps: MCubeProps): void {
    this.entity.setLocalScale(mCubeProps.width, mCubeProps.height, mCubeProps.depth);
    this.collisionComponent.halfExtents.set(
      mCubeProps.width / 2,
      mCubeProps.height / 2,
      mCubeProps.depth / 2,
    );
    this.collisionComponent.onSetHalfExtents();
  }

  setWidth(width: number, mCubeProps: MCubeProps): void {
    this.updateSize(mCubeProps);
  }

  setHeight(height: number, mCubeProps: MCubeProps): void {
    this.updateSize(mCubeProps);
  }

  setDepth(depth: number, mCubeProps: MCubeProps): void {
    this.updateSize(mCubeProps);
  }

  setCastShadows(castShadows: boolean, mCubeProps: MCubeProps): void {
    this.modelComponent.castShadows = castShadows;
  }

  setOpacity(opacity: number, mCubeProps: MCubeProps): void {
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
