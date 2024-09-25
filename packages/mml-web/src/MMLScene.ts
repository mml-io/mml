import { DebugHelper } from "./debug-helper/DebugHelper";
import {
  Audio,
  ChatProbe,
  Cube,
  Cylinder,
  Frame,
  Image,
  Interaction,
  Label,
  Light,
  MElement,
  Model,
  Plane,
  PositionProbe,
  Prompt,
  RemoteDocument,
  Sphere,
  TransformableElement,
  Video,
} from "./elements";
import { AudioGraphics } from "./graphics/AudioGraphics";
import { ChatProbeGraphics } from "./graphics/ChatProbeGraphics";
import { CubeGraphics } from "./graphics/CubeGraphics";
import { CylinderGraphics } from "./graphics/CylinderGraphics";
import { DebugHelperGraphics } from "./graphics/DebugHelperGraphics";
import { FrameGraphics } from "./graphics/FrameGraphics";
import { ImageGraphics } from "./graphics/ImageGraphics";
import { InteractionGraphics } from "./graphics/InteractionGraphics";
import { LabelGraphics } from "./graphics/LabelGraphics";
import { LightGraphics } from "./graphics/LightGraphics";
import { MElementGraphics } from "./graphics/MElementGraphics";
import { ModelGraphics } from "./graphics/ModelGraphics";
import { PlaneGraphics } from "./graphics/PlaneGraphics";
import { PositionProbeGraphics } from "./graphics/PositionProbeGraphics";
import { PromptGraphics } from "./graphics/PromptGraphics";
import { RemoteDocumentGraphics } from "./graphics/RemoteDocumentGraphics";
import { SphereGraphics } from "./graphics/SphereGraphics";
import { TransformableGraphics } from "./graphics/TransformableGraphics";
import { VideoGraphics } from "./graphics/VideoGraphics";
import { GraphicsAdapter, StandaloneGraphicsAdapter } from "./GraphicsAdapter";
import { InteractionManager } from "./interaction-ui";
import { LoadingProgressManager } from "./loading/LoadingProgressManager";
import { PromptManager } from "./prompt-ui";

export interface MMLGraphicsInterface<C extends GraphicsAdapter> {
  MMLDebugHelperGraphicsInterface<G extends C>(debugHelper: DebugHelper<G>): DebugHelperGraphics<G>;
  RemoteDocumentGraphicsInterface: (element: RemoteDocument<C>) => RemoteDocumentGraphics<C>;
  MElementGraphicsInterface: (element: MElement<C>) => MElementGraphics<C>;
  MMLTransformableGraphicsInterface: (element: TransformableElement<C>) => TransformableGraphics<C>;
  MMLImageGraphicsInterface: (
    element: Image<C>,
    updateMeshCallback: () => void,
  ) => ImageGraphics<C>;
  MMLVideoGraphicsInterface: (
    element: Video<C>,
    updateMeshCallback: () => void,
  ) => VideoGraphics<C>;
  MMLAudioGraphicsInterface: (element: Audio<C>) => AudioGraphics<C>;
  MMLCubeGraphicsInterface: (element: Cube<C>) => CubeGraphics<C>;
  MMLLabelGraphicsInterface: (element: Label<C>) => LabelGraphics<C>;
  MMLPlaneGraphicsInterface: (element: Plane<C>) => PlaneGraphics<C>;
  MMLPromptGraphicsInterface: (element: Prompt<C>) => PromptGraphics<C>;
  MMLInteractionGraphicsInterface: (element: Interaction<C>) => InteractionGraphics<C>;
  MMLChatProbeGraphicsInterface: (element: ChatProbe<C>) => ChatProbeGraphics<C>;
  MMLPositionProbeGraphicsInterface: (element: PositionProbe<C>) => PositionProbeGraphics<C>;
  MMLSphereGraphicsInterface: (element: Sphere<C>) => SphereGraphics<C>;
  MMLCylinderGraphicsInterface: (element: Cylinder<C>) => CylinderGraphics<C>;
  MMLLightGraphicsInterface: (element: Light<C>) => LightGraphics<C>;
  MMLFrameGraphicsInterface: (element: Frame<C>) => FrameGraphics<C>;
  MMLModelGraphicsInterface: (
    element: Model<C>,
    updateMeshCallback: () => void,
  ) => ModelGraphics<C>;
}

export type PositionAndRotation = {
  position: { x: number; y: number; z: number };
  // rotation in degrees
  rotation: { x: number; y: number; z: number };
};

export type InteractionListener<G extends GraphicsAdapter = GraphicsAdapter> = {
  addInteraction(interaction: Interaction<G>): void;
  updateInteraction(interaction: Interaction<G>): void;
  removeInteraction(interaction: Interaction<G>): void;
};

export type ChatProbeListener<G extends GraphicsAdapter = GraphicsAdapter> = {
  addChatProbe(chatProbe: ChatProbe<G>): void;
  updateChatProbe(chatProbe: ChatProbe<G>): void;
  removeChatProbe(chatProbe: ChatProbe<G>): void;
};

export type PromptProps = {
  message?: string;
  placeholder?: string;
  prefill?: string;
};

export type LinkProps = {
  href: string;
  target?: string;
  popup?: boolean;
};

/**
 * The IMMLScene interface is the public interface for attaching content (E.g.
 * an MML Document) into the underlyingScene, but it can be implemented by
 * classes other than MMLScene.
 */
export type IMMLScene<G extends GraphicsAdapter = GraphicsAdapter> = {
  getGraphicsAdapter: () => G;

  getRootContainer: () => ReturnType<G["getRootContainer"]>;

  addCollider?: (collider: unknown, element: MElement<G>) => void;
  updateCollider?: (collider: unknown, element: MElement<G>) => void;
  removeCollider?: (collider: unknown, element: MElement<G>) => void;

  addInteraction?: (interaction: Interaction<G>) => void;
  updateInteraction?: (interaction: Interaction<G>) => void;
  removeInteraction?: (interaction: Interaction<G>) => void;

  addChatProbe?: (chatProbe: ChatProbe<G>) => void;
  updateChatProbe?: (chatProbe: ChatProbe<G>) => void;
  removeChatProbe?: (chatProbe: ChatProbe<G>) => void;

  getUserPositionAndRotation(): PositionAndRotation;

  prompt: (
    promptProps: PromptProps,
    abortSignal: AbortSignal,
    callback: (message: string | null) => void,
  ) => void;

  link: (
    linkProps: LinkProps,
    abortSignal: AbortSignal,
    windowCallback: (openedWindow: Window | null) => void,
  ) => void;

  getLoadingProgressManager?: () => LoadingProgressManager | null;
};

/**
 * The MMLScene class creates a HTML Element that renders a scene and includes the various manager instances
 * for handling clicks, interaction events, and controls.
 *
 * It is the default implementation of the IMMLScene interface and presents a fly camera with drag controls.
 */
export class MMLScene<G extends StandaloneGraphicsAdapter<any, any, any>> implements IMMLScene<G> {
  private colliders = new Set<unknown>();

  private interactions = new Set<Interaction<G>>();
  private interactionListeners = new Set<InteractionListener<G>>();

  private chatProbes = new Set<ChatProbe<G>>();
  private chatProbeListeners = new Set<ChatProbeListener<G>>();

  private resizeListener: () => void;
  private promptManager: PromptManager;
  private interactionManager: InteractionManager;
  private resizeObserver: ResizeObserver;
  private loadingProgressManager: LoadingProgressManager;

  private graphicsAdapter: G | null = null;

  constructor(private element: HTMLElement) {
    this.loadingProgressManager = new LoadingProgressManager();
  }

  public init(graphicsAdapter: G) {
    this.graphicsAdapter = graphicsAdapter;
    this.graphicsAdapter.start();

    this.resizeObserver = new ResizeObserver(() => {
      this.fitContainer();
    });
    this.resizeObserver.observe(this.element);

    this.promptManager = PromptManager.init(this.element);
    const { interactionManager, interactionListener } = InteractionManager.init(
      this.element,
      this.graphicsAdapter.interactionShouldShowDistance.bind(this.graphicsAdapter),
    );
    this.interactionManager = interactionManager;
    this.addInteractionListener(interactionListener);

    this.resizeListener = () => {
      this.fitContainer();
    };
    window.addEventListener("resize", this.resizeListener, false);

    this.fitContainer();
  }

  public getGraphicsAdapter(): G {
    if (!this.graphicsAdapter) {
      throw new Error("MMLScene not initialized with a graphics adapter. Call init() first.");
    }
    return this.graphicsAdapter;
  }

  public getRootContainer(): G["containerType"] {
    if (!this.graphicsAdapter) {
      throw new Error("MMLScene not initialized with a graphics adapter");
    }
    return this.graphicsAdapter.getRootContainer();
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
    this.promptManager.dispose();
    this.interactionManager.dispose();
  }

  public prompt(
    promptProps: PromptProps,
    abortSignal: AbortSignal,
    callback: (message: string | null) => void,
  ) {
    if (!this) {
      console.error("MMLScene not initialized");
      return;
    }
    this.promptManager.prompt(promptProps, abortSignal, callback);
  }

  public link(
    linkProps: LinkProps,
    abortSignal: AbortSignal,
    windowCallback: (openedWindow: Window | null) => void,
  ) {
    this.promptManager.link(linkProps, abortSignal, windowCallback);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public addCollider(collider: unknown, element: MElement<G>): void {
    this.colliders.add(collider);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public updateCollider(collider: unknown): void {
    // no-op
  }

  public removeCollider(collider: unknown): void {
    this.colliders.delete(collider);
  }

  public addInteraction(interaction: Interaction<G>): void {
    this.interactions.add(interaction);
    for (const listener of this.interactionListeners) {
      listener.addInteraction(interaction);
    }
  }

  public updateInteraction(interaction: Interaction<G>): void {
    for (const listener of this.interactionListeners) {
      listener.updateInteraction(interaction);
    }
  }

  public removeInteraction(interaction: Interaction<G>): void {
    this.interactions.delete(interaction);
    for (const listener of this.interactionListeners) {
      listener.removeInteraction(interaction);
    }
  }

  public getInteractions(): Set<Interaction<G>> {
    return this.interactions;
  }

  public addInteractionListener(
    listener: InteractionListener<G>,
    addExistingInteractions = true,
  ): void {
    this.interactionListeners.add(listener);
    if (addExistingInteractions) {
      for (const interaction of this.interactions) {
        listener.addInteraction(interaction);
      }
    }
  }

  public removeInteractionListener(listener: InteractionListener<G>): void {
    this.interactionListeners.delete(listener);
  }

  public addChatProbe(chatProbe: ChatProbe<G>): void {
    this.chatProbes.add(chatProbe);
    for (const listener of this.chatProbeListeners) {
      listener.addChatProbe(chatProbe);
    }
  }

  public updateChatProbe(chatProbe: ChatProbe<G>): void {
    for (const listener of this.chatProbeListeners) {
      listener.updateChatProbe(chatProbe);
    }
  }

  public removeChatProbe(chatProbe: ChatProbe<G>): void {
    this.chatProbes.delete(chatProbe);
    for (const listener of this.chatProbeListeners) {
      listener.removeChatProbe(chatProbe);
    }
  }

  public getLoadingProgressManager(): LoadingProgressManager {
    return this.loadingProgressManager;
  }

  public getChatProbes(): Set<ChatProbe<G>> {
    return this.chatProbes;
  }

  public addChatProbeListener(listener: ChatProbeListener<G>, addExistingChatProbes = true): void {
    this.chatProbeListeners.add(listener);
    if (addExistingChatProbes) {
      for (const chatProbe of this.chatProbes) {
        listener.addChatProbe(chatProbe);
      }
    }
  }

  public removeChatProbeListener(listener: ChatProbeListener<G>): void {
    this.chatProbeListeners.delete(listener);
  }
}
