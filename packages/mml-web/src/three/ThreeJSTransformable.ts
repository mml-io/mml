import * as THREE from "three";

import { TransformableElement, TransformableElementProps } from "../elements";
import { TransformableGraphics } from "../MMLGraphicsInterface";

export class ThreeJSTransformable extends TransformableGraphics {
  constructor(private transformableElement: TransformableElement) {
    super(transformableElement);
  }

  setVisibility(visible: boolean): void {
    this.getContainer().visible = visible;
  }

  private getContainer(): THREE.Group {
    return this.transformableElement.getContainer() as THREE.Group;
  }

  setX(x: number, transformableElementProps: TransformableElementProps): void {
    this.getContainer().position.x = x;
  }

  setY(y: number, transformableElementProps: TransformableElementProps): void {
    this.getContainer().position.y = y;
  }

  setZ(z: number, transformableElementProps: TransformableElementProps): void {
    this.getContainer().position.z = z;
  }

  setRotationX(rotationX: number, transformableElementProps: TransformableElementProps): void {
    this.getContainer().rotation.x = rotationX * THREE.MathUtils.DEG2RAD;
  }

  setRotationY(rotationY: number, transformableElementProps: TransformableElementProps): void {
    this.getContainer().rotation.y = rotationY * THREE.MathUtils.DEG2RAD;
  }

  setRotationZ(rotationZ: number, transformableElementProps: TransformableElementProps): void {
    this.getContainer().rotation.z = rotationZ * THREE.MathUtils.DEG2RAD;
  }

  setScaleX(scaleX: number, transformableElementProps: TransformableElementProps): void {
    this.getContainer().scale.x = scaleX;
  }

  setScaleY(scaleY: number, transformableElementProps: TransformableElementProps): void {
    this.getContainer().scale.y = scaleY;
  }

  setScaleZ(scaleZ: number, transformableElementProps: TransformableElementProps): void {
    this.getContainer().scale.z = scaleZ;
  }

  dispose() {}
}
