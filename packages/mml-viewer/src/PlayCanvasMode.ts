import { FormIteration } from "./FormIteration";
import { GraphicsMode } from "./GraphicsMode";
import { MMLSourceDefinition } from "./MMLSource";

export class PlayCanvasMode implements GraphicsMode {
  private disposed = false;
  private internalMode: GraphicsMode | null = null;

  public readonly type = "playcanvas";

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
      const { PlayCanvasModeInternal } = await import("./PlayCanvasModeInternal");
      return new PlayCanvasModeInternal(
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

  dispose() {
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
