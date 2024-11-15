import { FullScreenMMLScene, StandaloneTagDebugAdapter } from "mml-web";

import { createFullscreenDiv } from "./CreateFullscreenDiv";
import { FormIteration } from "./FormIteration";
import { GraphicsMode } from "./GraphicsMode";
import { MMLSource, MMLSourceDefinition } from "./MMLSource";
import { StatusElement } from "./StatusElement";

export class TagsMode implements GraphicsMode {
  private element: HTMLDivElement;
  private disposed = false;

  private loadedState: {
    mmlSource: MMLSource;
    graphicsAdapter: StandaloneTagDebugAdapter;
    fullScreenMMLScene: FullScreenMMLScene<StandaloneTagDebugAdapter>;
    statusElement: StatusElement;
  } | null = null;

  constructor(
    private windowTarget: Window,
    private targetForWrappers: HTMLElement,
    private mmlSourceDefinition: MMLSourceDefinition,
    private formIteration: FormIteration,
  ) {
    this.element = createFullscreenDiv();
    this.init();
  }

  public readonly type = "tags";

  private async init() {
    const graphicsAdapter = await StandaloneTagDebugAdapter.create(this.element);
    if (this.disposed) {
      graphicsAdapter.dispose();
      return;
    }

    const fullScreenMMLScene = new FullScreenMMLScene<StandaloneTagDebugAdapter>(this.element);
    fullScreenMMLScene.init(graphicsAdapter);
    const statusElement = new StatusElement();
    const mmlSource = MMLSource.create({
      fullScreenMMLScene,
      statusElement,
      source: this.mmlSourceDefinition,
      windowTarget: this.windowTarget,
      targetForWrappers: this.targetForWrappers,
    });
    this.loadedState = {
      mmlSource,
      graphicsAdapter,
      fullScreenMMLScene,
      statusElement,
    };
    this.update(this.formIteration);
  }

  dispose() {
    this.disposed = true;
    if (this.loadedState) {
      this.loadedState.mmlSource.dispose();
      this.loadedState.graphicsAdapter.dispose();
      this.loadedState.fullScreenMMLScene.dispose();
      this.loadedState.statusElement.dispose();
      this.loadedState = null;
    }
    this.element.remove();
  }

  update(formIteration: FormIteration) {
    formIteration.completed();
  }
}
