import {
  ChatProbe,
  IMMLScene,
  Interaction,
  LoadingProgressManager,
  PositionAndRotation,
} from "@mml-io/mml-web";

import { GameThreeJSAdapter } from "./GameThreeJSAdapter";

export class NonInteractiveMMLScene implements IMMLScene<GameThreeJSAdapter> {
  private resizeListener: () => void;
  private resizeObserver: ResizeObserver;
  private loadingProgressManager: LoadingProgressManager;

  private graphicsAdapter: GameThreeJSAdapter | null = null;

  constructor(public element: HTMLElement) {
    this.loadingProgressManager = new LoadingProgressManager();
  }

  public init(graphicsAdapter: GameThreeJSAdapter) {
    this.graphicsAdapter = graphicsAdapter;
    this.graphicsAdapter.start();

    this.resizeObserver = new ResizeObserver(() => {
      this.fitContainer();
    });
    this.resizeObserver.observe(this.element);

    this.resizeListener = () => {
      this.fitContainer();
    };
    window.addEventListener("resize", this.resizeListener, false);

    this.fitContainer();
  }

  public hasGraphicsAdapter(): boolean {
    return this.graphicsAdapter !== null;
  }

  public getGraphicsAdapter(): GameThreeJSAdapter {
    if (!this.graphicsAdapter) {
      throw new Error("MMLScene not initialized with a graphics adapter. Call init() first.");
    }
    return this.graphicsAdapter;
  }

  public getRootContainer(): ReturnType<GameThreeJSAdapter["getRootContainer"]> {
    if (!this.graphicsAdapter) {
      throw new Error("MMLScene not initialized with a graphics adapter");
    }
    return this.graphicsAdapter.getRootContainer() as any;
  }

  public getUserPositionAndRotation(): PositionAndRotation {
    if (!this.graphicsAdapter) {
      throw new Error("MMLScene not initialized with a graphics adapter");
    }
    return this.graphicsAdapter.getUserPositionAndRotation();
  }

  public fitContainer() {
    if (!this.graphicsAdapter) {
      throw new Error("MMLScene not initialized with a graphics adapter");
    }
    const width = this.element.clientWidth;
    const height = this.element.clientHeight;
    this.graphicsAdapter.resize(width, height);
  }

  public dispose() {
    window.removeEventListener("resize", this.resizeListener);
    this.resizeObserver.disconnect();
  }

  public prompt() {
    // no-op
  }

  public link() {
    // no-op
  }

  public addCollider(): void {
    // no-op
  }

  public updateCollider(): void {
    // no-op
  }

  public removeCollider(): void {
    // no-op
  }

  public addInteraction(): void {
    // no-op
  }

  public updateInteraction(): void {
    // no-op
  }

  public removeInteraction(): void {
    // no-op
  }

  public getInteractions(): Set<Interaction<GameThreeJSAdapter>> {
    return new Set();
  }

  public addInteractionListener(): void {
    // no-op
  }

  public removeInteractionListener(): void {
    // no-op
  }

  public addChatProbe(): void {
    // no-op
  }

  public updateChatProbe(): void {
    // no-op
  }

  public removeChatProbe(): void {
    // no-op
  }

  public getLoadingProgressManager(): LoadingProgressManager {
    return this.loadingProgressManager;
  }

  public getChatProbes(): Set<ChatProbe<GameThreeJSAdapter>> {
    return new Set();
  }

  public addChatProbeListener(): void {
    // no-op
  }

  public removeChatProbeListener(): void {
    // no-op
  }
}
