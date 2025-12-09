import {
  hasEditorSupport,
  MElement,
  RemoteDocumentWrapper,
  SceneClickCallback,
  TransformableElement,
  TransformMode,
  TransformSpace,
  TransformSnapping,
  TransformValues,
  TransformWidgetController,
  TransformWidgetControllerCallbacks,
  VisualizerManager,
} from "@mml-io/mml-web"; 
import { EditableNetworkedDOM, NetworkedDOM } from "@mml-io/networked-dom-document";
import { NetworkedDOMWebsocket, NetworkedDOMWebsocketStatus } from "@mml-io/networked-dom-web";
import { FakeWebsocket } from "@mml-io/networked-dom-web-runner";

import { NavMeshDebugOverlay } from "../navigation/NavMeshDebugOverlay";
import { PhysicsDebugOverlay } from "../physics/PhysicsDebugOverlay";
import { ControlManager, ControlManagerConfig } from "./control-manager";
import { GameThreeJSAdapter, GameThreeJSAdapterControlsType } from "./GameThreeJSAdapter";
import { InteractiveMMLScene } from "./InteractiveMMLScene";
import { NonInteractiveMMLScene } from "./NonInteractiveMMLScene";

/**
 * Callbacks for editor selection/transform events.
 */
export interface MMLWebClientEditorCallbacks {
  /** Called when selection changes from viewport interaction */
  onSelectionChange?: (elements: HTMLElement[] | null) => void;
  /** Called when a transform operation completes */
  onTransformCommit?: (element: HTMLElement, values: TransformValues) => void;
  /** Called during transform drag for live preview */
  onTransformPreview?: (element: HTMLElement, values: TransformValues) => void;
  /** Called when drag state changes */
  onDragStateChange?: (isDragging: boolean) => void;
}

export type MMLWebClientOptions = {
  controlManagerConfig?: Partial<ControlManagerConfig>;
  isEditorMode?: boolean;
};

export class MMLWebClient {
  public readonly element: HTMLDivElement;
  public remoteDocumentHolder: HTMLElement;
  private disposed = false;

  remoteDocumentWrapper?: RemoteDocumentWrapper;
  mScene: InteractiveMMLScene | NonInteractiveMMLScene;
  private controlManager?: ControlManager;
  private debugOverlay?: PhysicsDebugOverlay;
  private navmeshOverlay?: NavMeshDebugOverlay;
  private debugMessageHandler?: (event: MessageEvent) => void;
  private controlManagerConfig?: Partial<ControlManagerConfig>;
  private isEditorMode: boolean;

  // Editor selection/transform support
  private transformController?: TransformWidgetController<GameThreeJSAdapter>;
  private editorCallbacks: MMLWebClientEditorCallbacks = {};

  private connectedState: {
    document?: NetworkedDOM | EditableNetworkedDOM;
    fakeWebsocket?: FakeWebsocket;
    domWebsocket: NetworkedDOMWebsocket;
  } | null = null;

  public static async create(
    windowTarget: Window,
    remoteHolderElement: HTMLElement,
    interactive: boolean,
    options: MMLWebClientOptions = {},
  ): Promise<MMLWebClient> {
    const client = new MMLWebClient(
      windowTarget,
      remoteHolderElement,
      interactive,
      options,
    );
    await client.init();
    return client;
  }

  constructor(
    private windowTarget: Window,
    private remoteHolderElement: HTMLElement,
    private interactive: boolean,
    options: MMLWebClientOptions = {},
  ) {
    this.windowTarget = windowTarget;
    this.remoteHolderElement = remoteHolderElement;
    this.controlManagerConfig = options.controlManagerConfig;
    this.isEditorMode = options.isEditorMode ?? false;

    // Create element the scene will be rendered in
    this.element = document.createElement("div");
    this.element.style.position = "relative";
    this.element.style.width = "100%";
    this.element.style.height = "100%";
    this.mScene = this.interactive
      ? new InteractiveMMLScene(this.element, { isEditorMode: this.isEditorMode })
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

    // Initialize transform controller for editor support
    this.initializeTransformController(graphicsAdapter);

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
          const obsVerts = data.obstacleVertices
            ? new Float32Array(data.obstacleVertices)
            : undefined;
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

  private initializeTransformController(graphicsAdapter: GameThreeJSAdapter): void {
    if (!hasEditorSupport(graphicsAdapter)) {
      console.warn("Graphics adapter does not support editor functionality");
      return;
    }

    this.transformController = new TransformWidgetController<GameThreeJSAdapter>({
      initialMode: "translate",
      initialSpace: "local",
      highlightConfig: {
        color: 0xffcc00,
        strength: 4.0,
        thickness: 1.5,
        glow: 0.0,
      },
    });

    // Create graphics implementations via generic interface
    const highlightHandle = graphicsAdapter.getHighlightManager().createHighlight({
      color: 0xffcc00,
      strength: 4.0,
      thickness: 1.5,
      glow: 0.0,
    });
    const widgetGraphics = graphicsAdapter.createTransformWidget(this.element);

    this.transformController.setGraphics(highlightHandle, widgetGraphics);

    // Set up scene click callback for selection
    const sceneClickCallback: SceneClickCallback = (element, event) => {
      if (!this.transformController) return false;

      // Check if we're dragging the gizmo - if so, don't handle selection
      if (this.transformController.isDragging()) {
        return false;
      }

      const isMultiSelect = event.shiftKey || event.ctrlKey || event.metaKey;

      if (element && MElement.isMElement(element) && "isTransformableElement" in element) {
        const transformable = element as TransformableElement<GameThreeJSAdapter>;
        const currentSelection = this.transformController.getSelectedElements();

        if (isMultiSelect) {
          // Toggle selection for multi-select
          const idx = currentSelection.indexOf(transformable);
          if (idx !== -1) {
            // Remove from selection
            const newSelection = [...currentSelection];
            newSelection.splice(idx, 1);
            this.transformController.setSelectedElements(newSelection);
          } else {
            // Add to selection
            this.transformController.setSelectedElements([...currentSelection, transformable]);
          }
        } else {
          // Single select - replace selection
          this.transformController.setSelectedElements([transformable]);
        }
      } else if (!isMultiSelect) {
        // Clicked on nothing - clear selection
        this.transformController.clearSelection();
      }

      return false; // Allow default click handling to continue
    };

    graphicsAdapter.setSceneClickCallback(sceneClickCallback);

    // Set up callbacks
    const callbacks: TransformWidgetControllerCallbacks = {
      onSelectionChange: (elements) => {
        console.log("[MMLWebClient] onSelectionChange callback:", elements?.length ?? 0, "elements");
        this.editorCallbacks.onSelectionChange?.(elements as HTMLElement[] | null);
      },
      onTransformPreview: (element, values) => {
        this.editorCallbacks.onTransformPreview?.(element as HTMLElement, values);
      },
      onTransformCommit: (element, values) => {
        console.log("[MMLWebClient] onTransformCommit callback fired");
        console.log("[MMLWebClient] Element:", (element as HTMLElement).tagName);
        console.log("[MMLWebClient] Values:", values);
        this.editorCallbacks.onTransformCommit?.(element as HTMLElement, values);
      },
      onDragStateChange: (isDragging) => {
        console.log("[MMLWebClient] onDragStateChange:", isDragging);
        this.editorCallbacks.onDragStateChange?.(isDragging);
        // Disable camera controls during drag
        if (graphicsAdapter.controls) {
          if (isDragging) {
            graphicsAdapter.controls.disable();
          } else {
            graphicsAdapter.controls.enable();
          }
        }
      },
    };
    this.transformController.setCallbacks(callbacks);
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

  // ==================== Editor Selection/Transform API ====================

  /**
   * Set editor event callbacks for selection and transform events.
   */
  public setEditorCallbacks(callbacks: MMLWebClientEditorCallbacks): void {
    this.editorCallbacks = callbacks;
  }

  /**
   * Set selected elements by passing actual element references.
   * @param elements Array of elements to select
   * @param lastSelectedIndex Index of the last selected element (for gizmo pivot)
   */
  public setSelectedElements(
    elements: HTMLElement[],
    lastSelectedIndex?: number,
  ): void {
    if (!this.transformController) return;

    // Convert HTMLElements to TransformableElements
    const transformableElements = elements
      .filter((el): el is TransformableElement<GameThreeJSAdapter> => {
        return MElement.isMElement(el) && "isTransformableElement" in el;
      });

    if (transformableElements.length > 0) {
      this.transformController.setSelectedElements(transformableElements, lastSelectedIndex);
      return;
    }

    if (elements.length > 0) {
      // Detach any gizmo selection but keep editor selection for non-transformable elements
      this.transformController.clearSelection(true);
      this.editorCallbacks.onSelectionChange?.(elements as HTMLElement[] | null);
      return;
    }

    this.transformController.clearSelection();
  }

  /**
   * Clear the current selection.
   */
  public clearSelection(): void {
    this.transformController?.clearSelection();
  }

  /**
   * Get currently selected elements.
   */
  public getSelectedElements(): HTMLElement[] {
    return (this.transformController?.getSelectedElements() ?? []) as HTMLElement[];
  }

  /**
   * Set the gizmo transform mode.
   * @param mode Transform mode (translate, rotate, scale)
   */
  public setGizmoMode(mode: TransformMode): void {
    this.transformController?.setMode(mode);
  }

  /**
   * Get the current gizmo transform mode.
   */
  public getGizmoMode(): TransformMode {
    return this.transformController?.getMode() ?? "translate";
  }

  /**
   * Set the gizmo coordinate space.
   * @param space Coordinate space (local or world)
   */
  public setGizmoSpace(space: TransformSpace): void {
    this.transformController?.setSpace(space);
  }

  /**
   * Get the current gizmo coordinate space.
   */
  public getGizmoSpace(): TransformSpace {
    return this.transformController?.getSpace() ?? "local";
  }

  /**
   * Toggle gizmo coordinate space between local and world.
   */
  public toggleGizmoSpace(): void {
    this.transformController?.toggleSpace();
  }

  /**
   * Enable or disable transform snapping.
   * @param enabled Whether snapping is enabled
   */
  public setSnapping(enabled: boolean): void {
    this.transformController?.setSnappingEnabled(enabled);
  }

  /**
   * Configure snapping increments for translation, rotation, and scale.
   */
  public setSnappingConfig(config: TransformSnapping): void {
    this.transformController?.setSnappingConfig(config);
  }

  /**
   * Check if the gizmo is currently being dragged.
   */
  public isGizmoDragging(): boolean {
    return this.transformController?.isDragging() ?? false;
  }

  /**
   * Set the visibility of element visualizers (lights, cameras, etc.)
   * @param visible Whether visualizers should be visible
   */
  public setVisualizersVisible(visible: boolean): void {
    VisualizerManager.get().setVisible(visible);
  }

  // ==================== End Editor API ====================

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

    // Dispose transform controller
    if (this.transformController) {
      this.transformController.dispose();
      this.transformController = undefined;
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

    const domWebsocket = this.connectToWebSocket(url, () => {
      setTimeout(() => {
        document.addWebSocket(fakeWebsocket.serverSideWebsocket as unknown as WebSocket);
      }, 1);
      return fakeWebsocket.clientSideWebsocket as unknown as WebSocket;
    });

    this.connectedState = {
      document,
      fakeWebsocket,
      domWebsocket,
    };
  }
}
