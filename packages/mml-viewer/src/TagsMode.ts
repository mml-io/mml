import {
  FullScreenMMLScene,
  MMLNetworkSource,
  NetworkedDOMWebsocketStatus,
  NetworkedDOMWebsocketStatusToString,
  StandaloneTagDebugAdapter,
  StatusUI,
} from "@mml-io/mml-web";

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
    private showDebugLoading: boolean,
  ) {
    this.init();
  }

  public readonly type = "tags";

  public updateSource(source: MMLSourceDefinition): void {
    this.mmlSourceDefinition = source;
    if (this.loadedState) {
      const existingSource = this.loadedState.mmlNetworkSource;
      existingSource.dispose();
      this.loadedState.mmlNetworkSource = MMLNetworkSource.create({
        mmlScene: this.loadedState.fullScreenMMLScene,
        statusUpdated: (status: NetworkedDOMWebsocketStatus) => {
          this.loadedState?.statusUI.setStatus(NetworkedDOMWebsocketStatusToString(status));
        },
        url: source.url,
        windowTarget: this.windowTarget,
        targetForWrappers: this.targetForWrappers,
      });
      setDebugGlobals({
        mmlScene: this.loadedState.fullScreenMMLScene,
        remoteDocumentWrapper: this.loadedState.mmlNetworkSource.remoteDocumentWrapper,
      });
    }
  }

  private async init() {
    const fullScreenMMLScene = new FullScreenMMLScene<StandaloneTagDebugAdapter>(
      this.showDebugLoading,
    );
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
          statusUI.setStatus(NetworkedDOMWebsocketStatusToString(status));
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
