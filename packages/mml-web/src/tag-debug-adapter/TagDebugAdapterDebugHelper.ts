import { DebugHelper } from "../debug-helper/DebugHelper";
import { DebugHelperGraphics } from "../graphics/DebugHelperGraphics";
import { TagDebugGraphicsAdapter } from "./StandaloneTagDebugAdapter";

export class TagDebugAdapterDebugHelper implements DebugHelperGraphics<TagDebugGraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(debugHelper: DebugHelper<TagDebugGraphicsAdapter>) {}

  dispose(): void {
    // no-op
  }
}
