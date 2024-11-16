import {
  Matr4,
  Model,
  TransformableElement,
  TransformableElementProps,
  TransformableGraphics,
} from "mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";
import { PlayCanvasModel } from "./PlayCanvasModel";

const halfToRad = 0.5 * playcanvas.math.DEG_TO_RAD;

// An implementation of XYZ ordered Euler angles in degrees to quaternion
function xyzDegreesToQuaternion(x: number, y: number, z: number): [number, number, number, number] {
  x *= halfToRad;
  y *= halfToRad;
  z *= halfToRad;
  const cx = Math.cos(x);
  const cy = Math.cos(y);
  const cz = Math.cos(z);

  const sx = Math.sin(x);
  const sy = Math.sin(y);
  const sz = Math.sin(z);

  return [
    sx * cy * cz + cx * sy * sz, // x
    cx * sy * cz - sx * cy * sz, // y
    cx * cy * sz + sx * sy * cz, // z
    cx * cy * cz - sx * sy * sz, // w
  ];
}

export class PlayCanvasTransformable extends TransformableGraphics<PlayCanvasGraphicsAdapter> {
  private socketName: string | null = null;

  constructor(private transformableElement: TransformableElement<PlayCanvasGraphicsAdapter>) {
    super(transformableElement);
  }

  getWorldMatrix(): Matr4 {
    return new Matr4(this.getPlayCanvasEntity().getWorldTransform().data);
  }

  setSocket(socketName: string | null): void {
    if (this.socketName !== socketName) {
      if (this.socketName !== null) {
        this.unregisterFromParentModel(this.socketName);
      }
      this.socketName = socketName;
      if (socketName !== null) {
        this.registerWithParentModel(socketName);
      }
    } else {
      this.socketName = socketName;
    }
  }

  private registerWithParentModel(socketName: string): void {
    if (
      (this.transformableElement.parentElement as Model<PlayCanvasGraphicsAdapter> | undefined)
        ?.isModel
    ) {
      const parentModel = this.transformableElement
        .parentElement as Model<PlayCanvasGraphicsAdapter>;
      (parentModel.modelGraphics as PlayCanvasModel).registerSocketChild(
        this.transformableElement,
        socketName,
      );
    }
  }

  private unregisterFromParentModel(socketName: string): void {
    if (
      (this.transformableElement.parentElement as Model<PlayCanvasGraphicsAdapter> | undefined)
        ?.isModel
    ) {
      const parentModel = this.transformableElement
        .parentElement as Model<PlayCanvasGraphicsAdapter>;
      (parentModel.modelGraphics as PlayCanvasModel).unregisterSocketChild(
        this.transformableElement,
        socketName,
      );
    }
  }

  setVisible(visible: boolean): void {
    this.getPlayCanvasEntity().enabled = visible;
  }

  private updatePosition(x: number, y: number, z: number): void {
    this.getPlayCanvasEntity().setLocalPosition(x, y, z);
  }

  setX(x: number, transformableElementProps: TransformableElementProps): void {
    this.updatePosition(
      transformableElementProps.x,
      transformableElementProps.y,
      transformableElementProps.z,
    );
  }

  setY(y: number, transformableElementProps: TransformableElementProps): void {
    this.updatePosition(
      transformableElementProps.x,
      transformableElementProps.y,
      transformableElementProps.z,
    );
  }

  setZ(z: number, transformableElementProps: TransformableElementProps): void {
    this.updatePosition(
      transformableElementProps.x,
      transformableElementProps.y,
      transformableElementProps.z,
    );
  }

  private getPlayCanvasEntity(): playcanvas.Entity {
    return this.transformableElement.getContainer() as playcanvas.Entity;
  }

  private updateRotation(rx: number, ry: number, rz: number): void {
    this.getPlayCanvasEntity().setLocalRotation(...xyzDegreesToQuaternion(rx, ry, rz));
  }

  setRotationX(rotationX: number, transformableElementProps: TransformableElementProps): void {
    this.updateRotation(
      transformableElementProps.rx,
      transformableElementProps.ry,
      transformableElementProps.rz,
    );
  }

  setRotationY(rotationY: number, transformableElementProps: TransformableElementProps): void {
    this.updateRotation(
      transformableElementProps.rx,
      transformableElementProps.ry,
      transformableElementProps.rz,
    );
  }

  setRotationZ(rotationZ: number, transformableElementProps: TransformableElementProps): void {
    this.updateRotation(
      transformableElementProps.rx,
      transformableElementProps.ry,
      transformableElementProps.rz,
    );
  }

  private updateScale(sx: number, sy: number, sz: number): void {
    this.getPlayCanvasEntity().setLocalScale(sx, sy, sz);
  }

  setScaleX(scaleX: number, transformableElementProps: TransformableElementProps): void {
    this.updateScale(
      transformableElementProps.sx,
      transformableElementProps.sy,
      transformableElementProps.sz,
    );
  }

  setScaleY(scaleY: number, transformableElementProps: TransformableElementProps): void {
    this.updateScale(
      transformableElementProps.sx,
      transformableElementProps.sy,
      transformableElementProps.sz,
    );
  }

  setScaleZ(scaleZ: number, transformableElementProps: TransformableElementProps): void {
    this.updateScale(
      transformableElementProps.sx,
      transformableElementProps.sy,
      transformableElementProps.sz,
    );
  }

  dispose() {}
}
