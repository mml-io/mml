import { MSphereProps, Sphere } from "../elements";
import { GraphicsAdapter } from "../GraphicsAdapter";
import { MMLColor } from "./MMLColor";

export abstract class SphereGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: Sphere<G>) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract getCollisionElement(): G["collisionType"];

  abstract setRadius(width: number, mSphereProps: MSphereProps): void;

  abstract setColor(color: MMLColor, mSphereProps: MSphereProps): void;

  abstract setOpacity(opacity: number, mSphereProps: MSphereProps): void;

  abstract setCastShadows(castShadows: boolean, mSphereProps: MSphereProps): void;

  abstract dispose(): void;
}
