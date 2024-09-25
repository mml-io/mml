import { DebugHelper } from "../debug-helper/DebugHelper";
import { GraphicsAdapter } from "../GraphicsAdapter";

export abstract class DebugHelperGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(debugHelper: DebugHelper<G>) {}

  abstract dispose(): void;
}
