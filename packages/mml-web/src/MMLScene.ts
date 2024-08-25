import * as playcanvas from "playcanvas";

import { ChatProbe } from "./elements/ChatProbe";
import { Interaction } from "./elements/Interaction";
import { MElement } from "./elements/MElement";
import { InteractionManager } from "./interaction-ui";
import { LoadingProgressManager } from "./loading/LoadingProgressManager";
import { MMLGraphicsInterface } from "./MMLGraphicsInterface";
import { PromptManager } from "./prompt-ui";

export type GraphicsAdapter = {
  getGraphicsAdapterFactory(): MMLGraphicsInterface<unknown>;
  getCamera(): unknown;
  getRootContainer(): unknown;
  resize(width: number, height: number): void;
  dispose(): void;
  getUserPositionAndRotation(): PositionAndRotation;
  start(): void;
};

export type PositionAndRotation = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
};

export type InteractionListener = {
  addInteraction(interaction: Interaction): void;
  updateInteraction(interaction: Interaction): void;
  removeInteraction(interaction: Interaction): void;
};

export type ChatProbeListener = {
  addChatProbe(chatProbe: ChatProbe): void;
  updateChatProbe(chatProbe: ChatProbe): void;
  removeChatProbe(chatProbe: ChatProbe): void;
};

export type PromptProps = {
  message?: string;
  placeholder?: string;
  prefill?: string;
};

/**
 * The IMMLScene interface is the public interface for attaching content (E.g.
 * an MML Document) into the underlyingScene, but it can be implemented by
 * classes other than MMLScene.
 */
export type IMMLScene = {
  getAudioListener: () => unknown;
  getRenderer: () => unknown;

  getGraphicsAdapterFactory: () => MMLGraphicsInterface<unknown>;

  getThreeScene: () => unknown;
  getCamera: () => unknown;
  getRootContainer: () => unknown;

  addCollider?: (collider: unknown, element: MElement) => void;
  updateCollider?: (collider: unknown, element: MElement) => void;
  removeCollider?: (collider: unknown, element: MElement) => void;

  addInteraction?: (interaction: Interaction) => void;
  updateInteraction?: (interaction: Interaction) => void;
  removeInteraction?: (interaction: Interaction) => void;

  addChatProbe?: (chatProbe: ChatProbe) => void;
  updateChatProbe?: (chatProbe: ChatProbe) => void;
  removeChatProbe?: (chatProbe: ChatProbe) => void;

  getUserPositionAndRotation(): PositionAndRotation;

  prompt: (promptProps: PromptProps, callback: (message: string | null) => void) => void;

  getLoadingProgressManager?: () => LoadingProgressManager | null;
};

export enum ControlsType {
  None,
  DragFly,
  PointerLockFly,
}

export type GraphicsAdapterOptions = {
  controlsType?: ControlsType;
};

export type MMLSceneOptions = {
  controlsType?: ControlsType;
  createGraphicsAdapter: (
    element: HTMLElement,
    mmlScene: IMMLScene,
    options: GraphicsAdapterOptions,
  ) => Promise<GraphicsAdapter>;
};

/**
 * The MMLScene class creates a HTML Element that renders a scene and includes the various manager instances
 * for handling clicks, interaction events, and controls.
 *
 * It is the default implementation of the IMMLScene interface and presents a fly camera with drag controls.
 */
export class MMLScene implements IMMLScene {
  public readonly element: HTMLDivElement;

  private colliders = new Set<unknown>();
  private interactions = new Set<Interaction>();
  private interactionListeners = new Set<InteractionListener>();
  private chatProbes = new Set<ChatProbe>();
  private chatProbeListeners = new Set<ChatProbeListener>();

  private resizeListener: () => void;
  private promptManager: PromptManager;
  private interactionManager: InteractionManager;
  private resizeObserver: ResizeObserver;
  private loadingProgressManager: LoadingProgressManager;
  private graphicsAdapter: GraphicsAdapter;

  constructor(private options: MMLSceneOptions) {
    this.element = document.createElement("div");
    this.element.style.width = "100%";
    this.element.style.height = "100%";
    this.element.style.position = "relative";

    this.loadingProgressManager = new LoadingProgressManager();
  }

  public async init() {
    this.graphicsAdapter = await this.options.createGraphicsAdapter(this.element, this, {
      controlsType: this.options.controlsType,
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.fitContainer();
    });
    this.resizeObserver.observe(this.element);

    this.promptManager = PromptManager.init(this.element);
    // const { interactionManager, interactionListener } = InteractionManager.init(
    //   this.element,
    //   this.camera,
    //   this.threeScene,
    // );
    // this.interactionManager = interactionManager;
    // this.addInteractionListener(interactionListener);

    this.resizeListener = () => {
      this.fitContainer();
    };

    window.addEventListener("resize", this.resizeListener, false);

    setTimeout(() => {
      this.graphicsAdapter.start();
      this.fitContainer();
    }, 0);
  }

  public getGraphicsAdapterFactory(): MMLGraphicsInterface<unknown> {
    return this.graphicsAdapter.getGraphicsAdapterFactory();
  }

  public getThreeScene(): playcanvas.Scene {
    return this.threeScene;
  }

  public getRenderer(): playcanvas.AppBase {
    return this.graphicsAdapter.playcanvasApp;
  }

  public getAudioListener(): playcanvas.AudioListener {
    return this.audioListener;
  }

  public getRootContainer(): unknown {
    return this.graphicsAdapter.getRootContainer();
  }

  public getCamera(): unknown {
    return this.graphicsAdapter.getCamera();
  }

  public getUserPositionAndRotation(): PositionAndRotation {
    return this.graphicsAdapter.getUserPositionAndRotation();
  }

  public fitContainer() {
    if (!this) {
      console.error("MMLScene not initialized");
      return;
    }
    const width = this.element.clientWidth;
    const height = this.element.clientHeight;
    this.graphicsAdapter.resize(width, height);
  }

  public dispose() {
    this.graphicsAdapter.dispose();
    window.removeEventListener("resize", this.resizeListener);
    this.resizeObserver.disconnect();
    this.promptManager.dispose();
    this.interactionManager.dispose();
  }

  public prompt(promptProps: PromptProps, callback: (message: string | null) => void) {
    if (!this) {
      console.error("MMLScene not initialized");
      return;
    }
    this.promptManager.prompt(promptProps, callback);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public addCollider(collider: playcanvas.Entity, element: MElement): void {
    this.colliders.add(collider);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public updateCollider(collider: playcanvas.Entity): void {
    // no-op
  }

  public removeCollider(collider: playcanvas.Entity): void {
    this.colliders.delete(collider);
  }

  public addInteraction(interaction: Interaction): void {
    this.interactions.add(interaction);
    for (const listener of this.interactionListeners) {
      listener.addInteraction(interaction);
    }
  }

  public updateInteraction(interaction: Interaction): void {
    for (const listener of this.interactionListeners) {
      listener.updateInteraction(interaction);
    }
  }

  public removeInteraction(interaction: Interaction): void {
    this.interactions.delete(interaction);
    for (const listener of this.interactionListeners) {
      listener.removeInteraction(interaction);
    }
  }

  public getInteractions(): Set<Interaction> {
    return this.interactions;
  }

  public addInteractionListener(
    listener: InteractionListener,
    addExistingInteractions = true,
  ): void {
    this.interactionListeners.add(listener);
    if (addExistingInteractions) {
      for (const interaction of this.interactions) {
        listener.addInteraction(interaction);
      }
    }
  }

  public removeInteractionListener(listener: InteractionListener): void {
    this.interactionListeners.delete(listener);
  }

  public addChatProbe(chatProbe: ChatProbe): void {
    this.chatProbes.add(chatProbe);
    for (const listener of this.chatProbeListeners) {
      listener.addChatProbe(chatProbe);
    }
  }

  public updateChatProbe(chatProbe: ChatProbe): void {
    for (const listener of this.chatProbeListeners) {
      listener.updateChatProbe(chatProbe);
    }
  }

  public removeChatProbe(chatProbe: ChatProbe): void {
    this.chatProbes.delete(chatProbe);
    for (const listener of this.chatProbeListeners) {
      listener.removeChatProbe(chatProbe);
    }
  }

  public getLoadingProgressManager(): LoadingProgressManager {
    return this.loadingProgressManager;
  }

  public getChatProbes(): Set<ChatProbe> {
    return this.chatProbes;
  }

  public addChatProbeListener(listener: ChatProbeListener, addExistingChatProbes = true): void {
    this.chatProbeListeners.add(listener);
    if (addExistingChatProbes) {
      for (const chatProbe of this.chatProbes) {
        listener.addChatProbe(chatProbe);
      }
    }
  }

  public removeChatProbeListener(listener: ChatProbeListener): void {
    this.chatProbeListeners.delete(listener);
  }

  // public getBoundingBoxForElement(element: HTMLElement): {
  //   x: number;
  //   y: number;
  //   width: number;
  //   height: number;
  // } | null {
  //   const camera = this.getCamera();
  //   const renderer = this.getRenderer();
  //
  //   if (!(element instanceof MElement)) {
  //     return null;
  //   }
  //
  //   const object = element.getContainer();
  //
  //   // Create a Box3 for the 3D bounding box
  //   const box3 = new playcanvas.Box3().setFromObject(object);
  //
  //   // Custom function to convert 3D Vector3 to 2D canvas coordinates
  //   const toCanvasCoords = (point: playcanvas.Vec3) => {
  //     const vec = point.clone().project(camera);
  //     vec.x = ((vec.x + 1) / 2) * renderer.domElement.clientWidth;
  //     vec.y = ((-vec.y + 1) / 2) * renderer.domElement.clientHeight;
  //     return vec;
  //   };
  //
  //   // Project the 3D bounding box corners into 2D canvas coordinates
  //   const corners3D = [
  //     new playcanvas.Vec3(box3.min.x, box3.min.y, box3.min.z),
  //     new playcanvas.Vec3(box3.max.x, box3.min.y, box3.min.z),
  //     new playcanvas.Vec3(box3.max.x, box3.min.y, box3.max.z),
  //     new playcanvas.Vec3(box3.min.x, box3.min.y, box3.max.z),
  //     new playcanvas.Vec3(box3.min.x, box3.max.y, box3.min.z),
  //     new playcanvas.Vec3(box3.max.x, box3.max.y, box3.min.z),
  //     new playcanvas.Vec3(box3.max.x, box3.max.y, box3.max.z),
  //     new playcanvas.Vec3(box3.min.x, box3.max.y, box3.max.z),
  //   ];
  //   const corners2D = corners3D.map(toCanvasCoords);
  //
  //   // Calculate the 2D bounding box from the projected canvas coordinates
  //   const minX = Math.min(...corners2D.map((corner) => corner.x));
  //   const maxX = Math.max(...corners2D.map((corner) => corner.x));
  //   const minY = Math.min(...corners2D.map((corner) => corner.y));
  //   const maxY = Math.max(...corners2D.map((corner) => corner.y));
  //
  //   return {
  //     x: minX,
  //     y: minY,
  //     width: maxX - minX,
  //     height: maxY - minY,
  //   };
  // }
}
