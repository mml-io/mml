import { TransformableElement, TransformableElementProps } from "../elements";
import { Matr4 } from "../math/Matr4";
import { GraphicsAdapter } from "./GraphicsAdapter";

export abstract class TransformableGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: TransformableElement<G>) {}

  abstract getWorldMatrix(): Matr4;

  abstract setSocket(
    socket: string | null,
    transformableElementProps: TransformableElementProps,
  ): void;

  abstract setX(x: number, transformableElementProps: TransformableElementProps): void;

  abstract setY(y: number, transformableElementProps: TransformableElementProps): void;

  abstract setZ(z: number, transformableElementProps: TransformableElementProps): void;

  abstract setRotationX(
    rotationX: number,
    transformableElementProps: TransformableElementProps,
  ): void;

  abstract setRotationY(
    rotationY: number,
    transformableElementProps: TransformableElementProps,
  ): void;

  abstract setRotationZ(
    rotationZ: number,
    transformableElementProps: TransformableElementProps,
  ): void;

  abstract setScaleX(scaleX: number, transformableElementProps: TransformableElementProps): void;

  abstract setScaleY(scaleY: number, transformableElementProps: TransformableElementProps): void;

  abstract setScaleZ(scaleZ: number, transformableElementProps: TransformableElementProps): void;

  abstract setVisible(visible: boolean, transformableElementProps: TransformableElementProps): void;

  abstract dispose(): void;
}
