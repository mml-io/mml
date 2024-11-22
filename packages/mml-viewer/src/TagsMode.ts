import {
  FullScreenMMLScene,
  MMLNetworkSource,
  NetworkedDOMWebsocketStatus,
  StandaloneTagDebugAdapter,
} from "@mml-io/mml-web";
import { StatusUI } from "@mml-io/mml-web";

import { FormIteration } from "./FormIteration";
import { GraphicsMode } from "./GraphicsMode";
import { MMLSourceDefinition } from "./MMLSourceDefinition";
import { setDebugGlobals } from "./setDebugGlobals";

export class TagsMode implements GraphicsMode {
  private disposed = false;

  private loadedState: {
    mmlNetworkSource: MMLNetworkSource;
    graphicsAdapter: StandaloneTagDebugAdapter;
    fullScreenMMLScene: FullScreenMMLScene<StandaloneTagDebugAdapter>;
    statusUI: StatusUI;
  } | null = null;

  constructor(
    private windowTarget: Window,
    private targetForWrappers: HTMLElement,
    private mmlSourceDefinition: MMLSourceDefinition,
    private formIteration: FormIteration,
  ) {
    this.init();
  }

  public readonly type = "tags";

  private async init() {
    const fullScreenMMLScene = new FullScreenMMLScene<StandaloneTagDebugAdapter>();
    document.body.append(fullScreenMMLScene.element);
    const graphicsAdapter = await StandaloneTagDebugAdapter.create(fullScreenMMLScene.element);
    if (this.disposed) {
      graphicsAdapter.dispose();
      return;
    }

    fullScreenMMLScene.init(graphicsAdapter);
    const statusUI = new StatusUI();
    const mmlNetworkSource = MMLNetworkSource.create({
      mmlScene: fullScreenMMLScene,
      statusUpdated: (status: NetworkedDOMWebsocketStatus) => {
        if (status === NetworkedDOMWebsocketStatus.Connected) {
          statusUI.setNoStatus();
        } else {
          statusUI.setStatus(NetworkedDOMWebsocketStatus[status]);
        }
      },
      url: this.mmlSourceDefinition.url,
      windowTarget: this.windowTarget,
      targetForWrappers: this.targetForWrappers,
    });
    setDebugGlobals({
      mmlScene: fullScreenMMLScene,
      remoteDocumentWrapper: mmlNetworkSource.remoteDocumentWrapper,
    });
    this.loadedState = {
      mmlNetworkSource,
      graphicsAdapter,
      fullScreenMMLScene,
      statusUI,
    };
    this.update(this.formIteration);
  }

  public dispose() {
    this.disposed = true;
    if (this.loadedState) {
      this.loadedState.mmlNetworkSource.dispose();
      this.loadedState.graphicsAdapter.dispose();
      this.loadedState.fullScreenMMLScene.dispose();
      this.loadedState.statusUI.dispose();
      this.loadedState = null;
    }
  }

  update(formIteration: FormIteration) {
    formIteration.completed();
  }
}
