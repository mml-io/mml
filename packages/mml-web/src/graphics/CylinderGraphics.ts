import { MMLColor } from "../color";
import { Cylinder, MCylinderProps } from "../elements";
import { GraphicsAdapter } from "./GraphicsAdapter";

export abstract class CylinderGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: Cylinder<G>) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract getCollisionElement(): G["collisionType"];

  abstract setRadius(radius: number, mCylinderProps: MCylinderProps): void;

  abstract setHeight(height: number, mCylinderProps: MCylinderProps): void;

  abstract setColor(color: MMLColor, mCylinderProps: MCylinderProps): void;

  abstract setOpacity(opacity: number, mCylinderProps: MCylinderProps): void;

  abstract setCastShadows(castShadows: boolean, mCylinderProps: MCylinderProps): void;

  abstract dispose(): void;
}
