import { MMLColor } from "../color";
import { Cube, MCubeProps } from "../elements";
import { GraphicsAdapter } from "./GraphicsAdapter";

export abstract class CubeGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: Cube<G>) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract getCollisionElement(): G["collisionType"];

  abstract setWidth(width: number, mCubeProps: MCubeProps): void;

  abstract setHeight(height: number, mCubeProps: MCubeProps): void;

  abstract setDepth(depth: number, mCubeProps: MCubeProps): void;

  abstract setColor(color: MMLColor, mCubeProps: MCubeProps): void;

  abstract setOpacity(opacity: number, mCubeProps: MCubeProps): void;

  abstract setCastShadows(castShadows: boolean, mCubeProps: MCubeProps): void;

  abstract dispose(): void;
}
