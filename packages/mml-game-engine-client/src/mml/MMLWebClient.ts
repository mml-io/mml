import { MMLScene, RemoteDocumentWrapper } from "@mml-io/mml-web";
import { EditableNetworkedDOM, NetworkedDOM } from "@mml-io/networked-dom-document";
import { NetworkedDOMWebsocket, NetworkedDOMWebsocketStatus } from "@mml-io/networked-dom-web";
import { FakeWebsocket } from "@mml-io/networked-dom-web-runner";

import { PhysicsDebugOverlay } from "../physics/PhysicsDebugOverlay";
import { NavMeshDebugOverlay } from "../navigation/NavMeshDebugOverlay";
import { ControlManager, ControlManagerConfig } from "./control-manager";
import { GameThreeJSAdapter, GameThreeJSAdapterControlsType } from "./GameThreeJSAdapter";
import { NonInteractiveMMLScene } from "./NonInteractiveMMLScene";

export class MMLWebClient {
  public readonly element: HTMLDivElement;
  public remoteDocumentHolder: HTMLElement;
  private disposed = false;

  remoteDocumentWrapper?: RemoteDocumentWrapper;
  mScene: MMLScene<GameThreeJSAdapter> | NonInteractiveMMLScene;
  private controlManager?: ControlManager;
  private debugOverlay?: PhysicsDebugOverlay;
  private navmeshOverlay?: NavMeshDebugOverlay;
  private debugMessageHandler?: (event: MessageEvent) => void;

  private connectedState: {
    document?: NetworkedDOM | EditableNetworkedDOM;
    fakeWebsocket?: FakeWebsocket;
    domWebsocket: NetworkedDOMWebsocket;
  } | null = null;

  public static async create(
    windowTarget: Window,
    remoteHolderElement: HTMLElement,
    interactive: boolean,
    controlManagerConfig?: Partial<ControlManagerConfig>,
  ): Promise<MMLWebClient> {
    const client = new MMLWebClient(
      windowTarget,
      remoteHolderElement,
      interactive,
      controlManagerConfig,
    );
    await client.init();
    return client;
  }

  constructor(
    private windowTarget: Window,
    private remoteHolderElement: HTMLElement,
    private interactive: boolean,
    private controlManagerConfig?: Partial<ControlManagerConfig>,
  ) {
    this.windowTarget = windowTarget;
    this.remoteHolderElement = remoteHolderElement;

    // Create element the scene will be rendered in
    this.element = document.createElement("div");
    this.element.style.position = "relative";
    this.element.style.width = "100%";
    this.element.style.height = "100%";
    this.mScene = this.interactive
      ? new MMLScene(this.element)
      : new NonInteractiveMMLScene(this.element);
  }

  private async init() {
    const graphicsAdapter = await GameThreeJSAdapter.create(this.element, {
      controlsType: GameThreeJSAdapterControlsType.DragFly,
    });

    if (!this.interactive) {
      // Disable clicking and audio for non-interactive scenes
      const adapter = graphicsAdapter as any;
      adapter.clickTrigger.dispose();
      graphicsAdapter.getAudioListener().setMasterVolume(0);
    }

    this.mScene.init(graphicsAdapter);

    // Attach physics debug overlay and message bridge from remote physics system
    try {
      const threeScene = graphicsAdapter.getThreeScene();
      this.debugOverlay = new PhysicsDebugOverlay(threeScene);
      this.navmeshOverlay = new NavMeshDebugOverlay(threeScene);
      this.debugMessageHandler = (event: MessageEvent) => {
        let data: any = event.data;
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        if (!data || data.source !== "ai-game-creator") return;
        if (data.type === "rapier-debug-buffers") {
          const verts = new Float32Array(data.vertices);
          const cols = new Float32Array(data.colors);
          this.debugOverlay?.updateBuffers(verts, cols);
          event.stopImmediatePropagation();
        } else if (data.type === "navmesh-debug-buffers") {
          const verts = new Float32Array(data.vertices);
          const cols = new Float32Array(data.colors);
          const triVerts = data.triVertices ? new Float32Array(data.triVertices) : undefined;
          const triCols = data.triColors ? new Float32Array(data.triColors) : undefined;
          const obsVerts = data.obstacleVertices ? new Float32Array(data.obstacleVertices) : undefined;
          const obsCols = data.obstacleColors ? new Float32Array(data.obstacleColors) : undefined;
          this.navmeshOverlay?.updateBuffers(verts, cols, triVerts, triCols, obsVerts, obsCols);
          event.stopImmediatePropagation();
        }
      };
      window.addEventListener("message", this.debugMessageHandler, {
        capture: true,
      });
    } catch (e) {
      console.warn("Failed to initialize physics debug overlay:", e);
    }
    this.fitContainer();

    if (this.interactive) {
      this.initializeControlManager();
    }
  }

  public fitContainer() {
    this.mScene.fitContainer();
  }

  private initializeControlManager(): void {
    try {
      this.controlManager = ControlManager.create(this, this.controlManagerConfig);

      const graphicsAdapter = this.mScene.getGraphicsAdapter();
      if (graphicsAdapter && "setControlRegistrationHandler" in graphicsAdapter) {
        graphicsAdapter.setControlRegistrationHandler(this.controlManager);
      }
    } catch (error) {
      console.error("MMLWebClient: Failed to initialize ControlManager:", error);
    }
  }

  public getControlManager(): ControlManager | undefined {
    return this.controlManager;
  }

  public dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.debugMessageHandler) {
      window.removeEventListener("message", this.debugMessageHandler, {
        capture: true,
      } as any);
      this.debugMessageHandler = undefined;
    }
    if (this.debugOverlay) {
      this.debugOverlay.dispose();
      this.debugOverlay = undefined;
    }
    if (this.navmeshOverlay) {
      this.navmeshOverlay.dispose();
      this.navmeshOverlay = undefined;
    }
    this.disconnect();

    if (this.controlManager) {
      this.controlManager.dispose();
      this.controlManager = undefined;
    }

    this.remoteDocumentHolder.remove();
    this.element.remove();
    this.mScene.dispose();
  }

  public disconnect() {
    if (!this.connectedState) {
      return;
    }

    // Empty current document content
    this.remoteDocumentHolder.innerHTML = "";

    // Disconnect local document
    if (this.connectedState.document) {
      try {
        this.connectedState.document.removeWebSocket(
          this.connectedState.fakeWebsocket?.serverSideWebsocket as unknown as WebSocket,
        );
      } catch (_e) {
        // The document may have already been disposed
      }
    }

    // Disconnect real socket
    else {
      this.connectedState.domWebsocket.stop();
    }

    this.connectedState = null;
  }

  private connectToWebSocket(url: string, factory: (url: string) => WebSocket) {
    console.log("🔗 Connecting to web socket...", url);
    // Create document wrapper to contain MML source
    const remoteDocumentWrapper = new RemoteDocumentWrapper(
      url,
      this.windowTarget,
      this.mScene,
      (element, event) => {
        this.connectedState?.domWebsocket?.handleEvent(element, event);
      },
    );
    this.remoteDocumentWrapper = remoteDocumentWrapper;
    this.remoteDocumentHolder = remoteDocumentWrapper.remoteDocument;
    this.remoteHolderElement.append(this.remoteDocumentHolder);

    return new NetworkedDOMWebsocket(
      url,
      factory,
      this.remoteDocumentHolder,
      (time: number) => {
        this.remoteDocumentWrapper?.setDocumentTime(time);
      },
      (status: NetworkedDOMWebsocketStatus) => {
        if (status === NetworkedDOMWebsocketStatus.Connected) {
          console.log("Socket connected");
        } else {
          console.log("Socket status", NetworkedDOMWebsocketStatus[status]);
        }
      },
      {
        tagPrefix: "m-",
        allowSVGElements: true,
      },
    );
  }

  public connectToSocket(url: string) {
    if (this.connectedState) this.disconnect();

    const domWebsocket = this.connectToWebSocket(url, NetworkedDOMWebsocket.createWebSocket);

    this.connectedState = {
      domWebsocket,
    };
  }

  public connectToDocument(document: NetworkedDOM | EditableNetworkedDOM, url: string) {
    if (!document) return;
    if (this.disposed) {
      console.warn("MMLWebClient already disposed", this);
      return;
    }
    if (this.connectedState) {
      this.disconnect();
    }

    const fakeWebsocket = new FakeWebsocket("networked-dom-v0.1");

    const domWebsocket = this.connectToWebSocket(
      url,
      () => {
        setTimeout(() => {
          document.addWebSocket(fakeWebsocket.serverSideWebsocket as unknown as WebSocket);
        }, 1);
        return fakeWebsocket.clientSideWebsocket as unknown as WebSocket;
      },
    );

    this.connectedState = {
      document,
      fakeWebsocket,
      domWebsocket,
    };
  }
}
