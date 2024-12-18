import { Cube, MCubeProps, MELEMENT_PROPERTY_NAME } from "@mml-io/mml-web";
import { CubeGraphics } from "@mml-io/mml-web";
import { MMLColor } from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

export class PlayCanvasCube extends CubeGraphics<PlayCanvasGraphicsAdapter> {
  private entity: playcanvas.Entity;
  private renderComponent: playcanvas.RenderComponent;
  private material: playcanvas.StandardMaterial = new playcanvas.StandardMaterial();

  constructor(private cube: Cube<PlayCanvasGraphicsAdapter>) {
    super(cube);

    /*
     The primitive must be in an internal entity to allow using setLocalScale
     without affecting children.
    */
    this.entity = new playcanvas.Entity(
      "cube-internal",
      cube.getScene().getGraphicsAdapter().getPlayCanvasApp(),
    );
    (this.entity as any)[MELEMENT_PROPERTY_NAME] = cube;
    this.renderComponent = this.entity.addComponent("render", {
      type: "box",
      material: this.material,
    }) as playcanvas.RenderComponent;
    this.entity.addComponent("collision", {
      type: "box",
      halfExtents: new playcanvas.Vec3(0.5, 0.5, 0.5),
    });
    cube.getContainer().addChild(this.entity);
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

  private updateSize(mCubeProps: MCubeProps): void {
    this.entity.setLocalScale(mCubeProps.width, mCubeProps.height, mCubeProps.depth);
    if (this.entity.collision) {
      this.entity.collision.halfExtents.set(
        mCubeProps.width / 2,
        mCubeProps.height / 2,
        mCubeProps.depth / 2,
      );
      // @ts-expect-error - accessing onSetHalfExtents private method
      this.entity.collision.onSetHalfExtents();
    }
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
