import {
  IVect3,
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
  private registeredSocketParent: ThreeJSModel | null = null;

  constructor(private transformableElement: TransformableElement<ThreeJSGraphicsAdapter>) {
    super(transformableElement);
  }

  getWorldMatrix(): Matr4 {
    // TODO - optimize/reduce calls to updateWorldMatrix
    const container = this.getContainer();
    container.updateWorldMatrix(true, false);
    return new Matr4(container.matrixWorld.elements as Matr4Data);
  }

  getWorldPosition(): IVect3 {
    return this.getContainer().getWorldPosition(new THREE.Vector3());
  }

  getLocalPosition(): IVect3 {
    return this.getContainer().position;
  }

  getVisible(): boolean {
    return this.getContainer().visible;
  }

  setVisible(visible: boolean): void {
    this.getContainer().visible = visible;
  }

  setSocket(socketName: string | null): void {
    if (this.socketName !== socketName) {
      if (this.socketName !== null && this.registeredSocketParent) {
        this.registeredSocketParent.unregisterSocketChild(
          this.transformableElement,
          this.socketName,
        );
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
    // Find the nearest ancestor that is a model (has isModel = true)
    // Start from parent to avoid matching self (e.g., when an m-model has a socket attribute)
    let current = this.transformableElement.parentElement as Element | null;
    while (current) {
      if ((current as Model<ThreeJSGraphicsAdapter> | undefined)?.isModel) {
        const parentModel = current as Model<ThreeJSGraphicsAdapter>;
        this.registeredSocketParent = parentModel.modelGraphics as ThreeJSModel;
        this.registeredSocketParent.registerSocketChild(this.transformableElement, socketName);
        return;
      }
      current = current.parentElement;
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

  dispose() {
    if (this.socketName && this.registeredSocketParent !== null) {
      this.registeredSocketParent.unregisterSocketChild(
        this.transformableElement,
        this.socketName,
        false,
      );
    }
  }
}
