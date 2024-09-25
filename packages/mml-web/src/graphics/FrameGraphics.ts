import { Frame, MFrameProps } from "../elements";
import { GraphicsAdapter } from "../GraphicsAdapter";

export abstract class FrameGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: Frame<G>) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract setSrc(src: string | null, mFrameProps: MFrameProps): void;

  abstract setDebug(debug: boolean, mFrameProps: MFrameProps): void;

  abstract setLoadRange(loadRange: number | null, mFrameProps: MFrameProps): void;

  abstract setUnloadRange(unloadRange: number, mFrameProps: MFrameProps): void;

  abstract setMinX(minX: number | null, mFrameProps: MFrameProps): void;

  abstract setMaxX(maxX: number | null, mFrameProps: MFrameProps): void;

  abstract setMinY(minY: number | null, mFrameProps: MFrameProps): void;

  abstract setMaxY(maxY: number | null, mFrameProps: MFrameProps): void;

  abstract setMinZ(minZ: number | null, mFrameProps: MFrameProps): void;

  abstract setMaxZ(maxZ: number | null, mFrameProps: MFrameProps): void;

  abstract dispose(): void;
}
