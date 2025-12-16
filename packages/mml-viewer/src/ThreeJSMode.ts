import { FormIteration } from "./FormIteration";
import { GraphicsMode } from "./GraphicsMode";
import { MMLSourceDefinition } from "./MMLSourceDefinition";
import { ThreeJSModeOptions } from "./ThreeJSModeInternal";

export class ThreeJSMode implements GraphicsMode {
  private disposed = false;
  private internalMode: GraphicsMode | null = null;

  public readonly type = "threejs";

  constructor(
    private windowTarget: Window,
    private targetForWrappers: HTMLElement,
    private mmlSource: MMLSourceDefinition,
    private formIteration: FormIteration,
    private options: ThreeJSModeOptions,
  ) {
    this.init();
  }

  public updateSource(source: MMLSourceDefinition): void {
    this.mmlSource = source;
    if (this.internalMode) {
      this.internalMode.updateSource(source);
    }
  }

  private async init() {
    this.internalMode = await (async () => {
      const { ThreeJSModeInternal } = await import("./ThreeJSModeInternal");
      return new ThreeJSModeInternal(
        this.windowTarget,
        this.targetForWrappers,
        this.mmlSource,
        this.formIteration,
        this.options,
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

  getRendererCanvas(): HTMLCanvasElement | null {
    if (!this.internalMode) {
      return null;
    }
    return this.internalMode.getRendererCanvas();
  }
}
