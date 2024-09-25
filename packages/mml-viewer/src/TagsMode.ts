import { StandaloneTagDebugAdapter } from "mml-web";

import {
  connectGraphicsAdapterToFullScreenScene,
  FullScreenState,
} from "./ConnectGraphicsAdapterToFullScreenScene";
import { createFullscreenDiv } from "./CreateFullscreenDiv";
import { FormIteration } from "./FormIteration";
import { GraphicsMode } from "./GraphicsMode";
import { MMLSource } from "./MMLSource";

export class TagsMode implements GraphicsMode {
  private element: HTMLDivElement;
  private disposed = false;
  private graphicsAdapter: StandaloneTagDebugAdapter | null = null;
  private fullScreen: FullScreenState | null = null;

  constructor(
    private windowTarget: Window,
    private targetForWrappers: HTMLElement,
    mmlSource: MMLSource,
    private formIteration: FormIteration,
  ) {
    this.element = createFullscreenDiv();
    this.init(mmlSource);
    // TODO - handle formIteration
  }

  public readonly type = "tags";

  private async init(mmlSource: MMLSource) {
    this.graphicsAdapter = await StandaloneTagDebugAdapter.create(this.element);
    if (this.disposed) {
      this.dispose();
      return;
    }

    this.fullScreen = connectGraphicsAdapterToFullScreenScene({
      element: this.element,
      graphicsAdapter: this.graphicsAdapter,
      source: mmlSource,
      windowTarget: this.windowTarget,
      targetForWrappers: this.targetForWrappers,
    });
    this.update(this.formIteration);
  }

  dispose() {
    this.disposed = true;
    if (this.fullScreen) {
      this.fullScreen.dispose();
      this.fullScreen = null;
    }
    if (this.graphicsAdapter) {
      this.graphicsAdapter.dispose();
      this.graphicsAdapter = null;
    }
    this.element.remove();
  }

  update(formIteration: FormIteration) {
    formIteration.completed();
  }
}
