import { TransformableElement, TransformableElementProps } from "../elements";
import { TransformableGraphics } from "../MMLGraphicsInterface";

export class PlayCanvasTransformable extends TransformableGraphics {
  constructor(private transformableElement: TransformableElement) {
    super(transformableElement);
  }

  setVisibility(visible: boolean): void {
    this.transformableElement.getContainer().visible = visible;
  }

  private updatePosition(x: number, y: number, z: number): void {
    this.transformableElement.getContainer().setLocalPosition(x, y, z);
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

  private updateRotation(rx: number, ry: number, rz: number): void {
    this.transformableElement.getContainer().setLocalEulerAngles(rx, ry, rz);
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
    this.transformableElement.getContainer().setLocalScale(sx, sy, sz);
    const collisionComponent = this.transformableElement.getContainer().collision;
    if (collisionComponent) {
      collisionComponent.onSetModel();
    }
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
