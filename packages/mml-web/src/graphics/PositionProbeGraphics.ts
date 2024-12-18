import { MPositionProbeProps, PositionProbe } from "../elements";
import { GraphicsAdapter } from "./GraphicsAdapter";

export abstract class PositionProbeGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: PositionProbe<G>) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract setRange(range: number, mPositionProbeProps: MPositionProbeProps): void;

  abstract setDebug(debug: boolean, mPositionProbeProps: MPositionProbeProps): void;

  abstract dispose(): void;
}
