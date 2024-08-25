import * as playcanvas from "playcanvas";

import { Cube, MCubeProps } from "../elements";
import { CubeGraphics, MMLColor } from "../MMLGraphicsInterface";

export class PlayCanvasCube extends CubeGraphics {
  private mesh: playcanvas.Entity;
  private modelComponent: playcanvas.ModelComponent;
  private collisionComponent: playcanvas.CollisionComponent;
  private material: playcanvas.StandardMaterial = new playcanvas.StandardMaterial();

  constructor(private cube: Cube) {
    super(cube);

    this.mesh = this.cube.getContainer();
    this.modelComponent = this.mesh.addComponent("model", {
      type: "box",
      material: this.material,
    })! as playcanvas.ModelComponent;
    this.collisionComponent = this.mesh.addComponent("collision", {
      type: "box",
      halfExtents: new playcanvas.Vec3(0.5, 0.5, 0.5),
    });
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
    this.mesh.setLocalScale(mCubeProps.width, mCubeProps.height, mCubeProps.depth);
    this.collisionComponent.halfExtents.set(mCubeProps.width / 2, mCubeProps.height / 2, mCubeProps.depth / 2);
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

  dispose() {}
}
