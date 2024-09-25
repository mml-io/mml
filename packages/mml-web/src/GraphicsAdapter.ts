import { Interaction } from "./elements";
import { MMLGraphicsInterface, PositionAndRotation } from "./MMLScene";

export interface GraphicsAdapter<C = unknown, M = unknown, R = unknown> {
  containerType: C;
  collisionType: M;

  getGraphicsAdapterFactory(): MMLGraphicsInterface<this>;

  getRootContainer(): R;

  getUserPositionAndRotation(): PositionAndRotation;

  interactionShouldShowDistance(interaction: Interaction<this>): number | null;

  dispose(): void;
}

export type StandaloneGraphicsAdapter<C = unknown, M = unknown, R = unknown> = GraphicsAdapter<
  C,
  M,
  R
> & {
  start(): void;
  resize(width: number, height: number): void;
};
