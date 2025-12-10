import { MMLColor } from "../color";
import { Capsule, MCapsuleProps } from "../elements";
import { GraphicsAdapter } from "./GraphicsAdapter";

export abstract class CapsuleGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: Capsule<G>) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract getCollisionElement(): G["collisionType"];

  abstract setRadius(radius: number, mCapsuleProps: MCapsuleProps): void;

  abstract setHeight(height: number, mCapsuleProps: MCapsuleProps): void;

  abstract setColor(color: MMLColor, mCapsuleProps: MCapsuleProps): void;

  abstract setOpacity(opacity: number, mCapsuleProps: MCapsuleProps): void;

  abstract setCastShadows(castShadows: boolean, mCapsuleProps: MCapsuleProps): void;

  abstract dispose(): void;
}
