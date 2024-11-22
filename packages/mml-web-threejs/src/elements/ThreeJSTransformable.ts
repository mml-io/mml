import {
  Matr4,
  Matr4Data,
  Model,
  TransformableElement,
  TransformableGraphics,
} from "@mml-io/mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";
import { ThreeJSModel } from "./ThreeJSModel";

export class ThreeJSTransformable extends TransformableGraphics<ThreeJSGraphicsAdapter> {
  private socketName: string | null = null;

  constructor(private transformableElement: TransformableElement<ThreeJSGraphicsAdapter>) {
    super(transformableElement);
  }

  getWorldMatrix(): Matr4 {
    // TODO - optimize/reduce calls to updateWorldMatrix
    const container = this.getContainer();
    container.updateWorldMatrix(true, false);
    return new Matr4(container.matrixWorld.elements as Matr4Data);
  }

  setVisible(visible: boolean): void {
    this.getContainer().visible = visible;
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
      (this.transformableElement.parentElement as Model<ThreeJSGraphicsAdapter> | undefined)
        ?.isModel
    ) {
      const parentModel = this.transformableElement.parentElement as Model<ThreeJSGraphicsAdapter>;
      (parentModel.modelGraphics as ThreeJSModel).registerSocketChild(
        this.transformableElement,
        socketName,
      );
    }
  }

  private unregisterFromParentModel(socketName: string): void {
    if (
      (this.transformableElement.parentElement as Model<ThreeJSGraphicsAdapter> | undefined)
        ?.isModel
    ) {
      const parentModel = this.transformableElement.parentElement as Model<ThreeJSGraphicsAdapter>;
      (parentModel.modelGraphics as ThreeJSModel).unregisterSocketChild(
        this.transformableElement,
        socketName,
      );
    }
  }

  private getContainer(): THREE.Group {
    return this.transformableElement.getContainer() as THREE.Group;
  }

  setX(x: number): void {
    this.getContainer().position.x = x;
  }

  setY(y: number): void {
    this.getContainer().position.y = y;
  }

  setZ(z: number): void {
    this.getContainer().position.z = z;
  }

  setRotationX(rotationX: number): void {
    this.getContainer().rotation.x = rotationX * THREE.MathUtils.DEG2RAD;
  }

  setRotationY(rotationY: number): void {
    this.getContainer().rotation.y = rotationY * THREE.MathUtils.DEG2RAD;
  }

  setRotationZ(rotationZ: number): void {
    this.getContainer().rotation.z = rotationZ * THREE.MathUtils.DEG2RAD;
  }

  setScaleX(scaleX: number): void {
    this.getContainer().scale.x = scaleX;
  }

  setScaleY(scaleY: number): void {
    this.getContainer().scale.y = scaleY;
  }

  setScaleZ(scaleZ: number): void {
    this.getContainer().scale.z = scaleZ;
  }

  dispose() {}
}
