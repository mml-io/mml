import { MPlaneProps, Plane } from "../elements";
import { GraphicsAdapter } from "../GraphicsAdapter";
import { MMLColor } from "./MMLColor";

export abstract class PlaneGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: Plane<G>) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract getCollisionElement(): G["collisionType"];

  abstract setWidth(width: number, mPlaneProps: MPlaneProps): void;

  abstract setHeight(height: number, mPlaneProps: MPlaneProps): void;

  abstract setColor(color: MMLColor, mPlaneProps: MPlaneProps): void;

  abstract setOpacity(opacity: number, mPlaneProps: MPlaneProps): void;

  abstract setCastShadows(castShadows: boolean, mPlaneProps: MPlaneProps): void;

  abstract dispose(): void;
}
