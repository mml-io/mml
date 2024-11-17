import { FormIteration } from "./FormIteration";
import { GraphicsMode } from "./GraphicsMode";
import { MMLSourceDefinition } from "./MMLSourceDefinition";

export class ThreeJSMode implements GraphicsMode {
  private disposed = false;
  private internalMode: GraphicsMode | null = null;

  public readonly type = "threejs";

  constructor(
    private windowTarget: Window,
    private targetForWrappers: HTMLElement,
    private mmlSource: MMLSourceDefinition,
    private formIteration: FormIteration,
  ) {
    this.init();
  }

  private async init() {
    this.internalMode = await (async () => {
      const { ThreeJSModeInternal } = await import("./ThreeJSModeInternal");
      return new ThreeJSModeInternal(
        this.windowTarget,
        this.targetForWrappers,
        this.mmlSource,
        this.formIteration,
      );
    })();
    if (this.disposed) {
      this.dispose();
      return;
    }
  }

  public dispose() {
    this.disposed = true;
    if (this.internalMode) {
      this.internalMode.dispose();
    }
  }

  update(formIteration: FormIteration) {
    this.formIteration = formIteration;
    if (!this.internalMode) {
      return;
    }
    this.internalMode.update(formIteration);
  }
}
