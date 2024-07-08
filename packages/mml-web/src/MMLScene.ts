import * as THREE from "three";

import { Controls } from "./camera/Controls";
import { DragFlyCameraControls } from "./camera/DragFlyCameraControls";
import { PointerLockFlyCameraControls } from "./camera/PointerLockFlyCameraControls";
import { ChatProbe } from "./elements/ChatProbe";
import { Interaction } from "./elements/Interaction";
import { MElement } from "./elements/MElement";
import { InteractionManager } from "./interaction-ui";
import { LoadingProgressManager } from "./loading/LoadingProgressManager";
import { MMLClickTrigger } from "./MMLClickTrigger";
import { PromptManager } from "./prompt-ui";

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

export type LinkProps = {
  href: string;
  popup?: boolean;
};

/**
 * The IMMLScene interface is the public interface for attaching content (E.g. an MML Document) into the underlying
 * (THREE.js) Scene, but it can be implemented by classes other than MMLScene.
 */
export type IMMLScene = {
  getAudioListener: () => THREE.AudioListener;
  getRenderer: () => THREE.Renderer;

  getThreeScene: () => THREE.Scene;
  getCamera: () => THREE.Camera;
  getRootContainer: () => THREE.Group;

  addCollider?: (collider: THREE.Object3D, element: MElement) => void;
  updateCollider?: (collider: THREE.Object3D, element: MElement) => void;
  removeCollider?: (collider: THREE.Object3D, element: MElement) => void;

  addInteraction?: (interaction: Interaction) => void;
  updateInteraction?: (interaction: Interaction) => void;
  removeInteraction?: (interaction: Interaction) => void;

  addChatProbe?: (chatProbe: ChatProbe) => void;
  updateChatProbe?: (chatProbe: ChatProbe) => void;
  removeChatProbe?: (chatProbe: ChatProbe) => void;

  getUserPositionAndRotation(): PositionAndRotation;

  prompt: (
    promptProps: PromptProps,
    abortSignal: AbortSignal,
    callback: (message: string | null) => void,
  ) => void;

  getLoadingProgressManager?: () => LoadingProgressManager | null;
  link: (
    linkProps: LinkProps,
    abortSignal: AbortSignal,
    windowCallback: (openedWindow: Window | null) => void,
  ) => void;
};

export enum ControlsType {
  None,
  DragFly,
  PointerLockFly,
}

export type MMLSceneOptions = {
  controlsType?: ControlsType;
};

/**
 * The MMLScene class creates a HTML Element that renders a THREE.js scene and includes the various manager instances
 * for handling clicks, interaction events, and controls.
 *
 * It is the default implementation of the IMMLScene interface and presents a fly camera with drag controls.
 */
export class MMLScene implements IMMLScene {
  public readonly element: HTMLDivElement;

  private readonly camera: THREE.PerspectiveCamera;
  private readonly audioListener: THREE.AudioListener;
  private readonly threeScene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private readonly rootContainer: THREE.Group;
  private controls: Controls | null = null;
  private colliders = new Set<THREE.Object3D>();
  private interactions = new Set<Interaction>();
  private interactionListeners = new Set<InteractionListener>();
  private chatProbes = new Set<ChatProbe>();
  private chatProbeListeners = new Set<ChatProbeListener>();

  private animationFrameCallback: () => void;
  private animationFrameRequest: number;
  private resizeListener: () => void;
  private clickTrigger: MMLClickTrigger;
  private promptManager: PromptManager;
  private interactionManager: InteractionManager;
  private resizeObserver: ResizeObserver;
  private loadingProgressManager: LoadingProgressManager;

  constructor(private options: MMLSceneOptions = {}) {
    this.element = document.createElement("div");
    this.element.style.width = "100%";
    this.element.style.height = "100%";
    this.element.style.position = "relative";

    this.rootContainer = new THREE.Group();
    this.threeScene = new THREE.Scene();
    this.threeScene.add(this.rootContainer);

    this.loadingProgressManager = new LoadingProgressManager();

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.01,
      1000,
    );
    this.renderer = this.createRenderer();

    this.audioListener = new THREE.AudioListener();
    if (this.audioListener.context.state === "suspended") {
      const resumeAudio = () => {
        this.audioListener.context.resume();
        document.removeEventListener("click", resumeAudio);
        document.removeEventListener("touchstart", resumeAudio);
      };
      document.addEventListener("click", resumeAudio);
      document.addEventListener("touchstart", resumeAudio);
    }
    this.camera.add(this.audioListener);
    this.camera.position.z = 10;
    this.camera.position.y = 5;

    THREE.Cache.enabled = true;

    this.resizeObserver = new ResizeObserver(() => {
      this.fitContainer();
    });
    this.resizeObserver.observe(this.element);

    switch (options.controlsType) {
      case ControlsType.None:
        break;
      case ControlsType.PointerLockFly:
        this.controls = new PointerLockFlyCameraControls(this.camera, this.element);
        break;
      case ControlsType.DragFly:
      default:
        this.controls = new DragFlyCameraControls(this.camera, this.element);
        break;
    }
    if (this.controls) {
      this.controls.enable();
    }

    this.clickTrigger = MMLClickTrigger.init(this.element, this);
    this.promptManager = PromptManager.init(this.element);
    const { interactionManager, interactionListener } = InteractionManager.init(
      this.element,
      this.camera,
      this.threeScene,
    );
    this.interactionManager = interactionManager;
    this.addInteractionListener(interactionListener);

    const clock = new THREE.Clock();

    this.animationFrameCallback = () => {
      this.animationFrameRequest = requestAnimationFrame(this.animationFrameCallback);
      if (this.controls) {
        this.controls.update(clock.getDelta());
      }
      this.renderer.render(this.threeScene, this.camera);
    };
    this.animationFrameRequest = requestAnimationFrame(this.animationFrameCallback);

    this.resizeListener = () => {
      this.fitContainer();
    };

    window.addEventListener("resize", this.resizeListener, false);

    this.element.appendChild(this.renderer.domElement);

    this.fitContainer();
  }

  public getThreeScene(): THREE.Scene {
    return this.threeScene;
  }

  public getRenderer(): THREE.Renderer {
    return this.renderer;
  }

  public getAudioListener(): THREE.AudioListener {
    return this.audioListener;
  }

  public getRootContainer(): THREE.Group {
    return this.rootContainer;
  }

  public getCamera(): THREE.Camera {
    return this.camera;
  }

  public getUserPositionAndRotation(): PositionAndRotation {
    return {
      position: this.camera.position,
      rotation: {
        x: this.camera.rotation.x,
        y: this.camera.rotation.y,
        z: this.camera.rotation.z,
      },
    };
  }

  private createRenderer() {
    let renderer;
    if (navigator.userAgent.includes("jsdom")) {
      renderer = {
        domElement: document.createElement("canvas"),
        setSize: () => void 0,
        render: () => void 0,
      } as unknown as THREE.WebGLRenderer;
    } else {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(0xffffff, 1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    renderer.domElement.style.pointerEvents = "none";
    return renderer;
  }

  public fitContainer() {
    if (!this) {
      console.error("MMLScene not initialized");
      return;
    }
    const width = this.element.clientWidth;
    const height = this.element.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public dispose() {
    cancelAnimationFrame(this.animationFrameRequest);
    window.removeEventListener("resize", this.resizeListener);
    this.resizeObserver.disconnect();
    this.rootContainer.clear();
    this.clickTrigger.dispose();
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
  public addCollider(collider: THREE.Object3D, element: MElement): void {
    this.colliders.add(collider);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public updateCollider(collider: THREE.Object3D): void {
    // no-op
  }

  public removeCollider(collider: THREE.Object3D): void {
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

  public getBoundingBoxForElement(element: HTMLElement): {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null {
    const camera = this.getCamera();
    const renderer = this.getRenderer();

    if (!(element instanceof MElement)) {
      return null;
    }

    const object = element.getContainer();

    // Create a Box3 for the 3D bounding box
    const box3 = new THREE.Box3().setFromObject(object);

    // Custom function to convert 3D Vector3 to 2D canvas coordinates
    const toCanvasCoords = (point: THREE.Vector3) => {
      const vec = point.clone().project(camera);
      vec.x = ((vec.x + 1) / 2) * renderer.domElement.clientWidth;
      vec.y = ((-vec.y + 1) / 2) * renderer.domElement.clientHeight;
      return vec;
    };

    // Project the 3D bounding box corners into 2D canvas coordinates
    const corners3D = [
      new THREE.Vector3(box3.min.x, box3.min.y, box3.min.z),
      new THREE.Vector3(box3.max.x, box3.min.y, box3.min.z),
      new THREE.Vector3(box3.max.x, box3.min.y, box3.max.z),
      new THREE.Vector3(box3.min.x, box3.min.y, box3.max.z),
      new THREE.Vector3(box3.min.x, box3.max.y, box3.min.z),
      new THREE.Vector3(box3.max.x, box3.max.y, box3.min.z),
      new THREE.Vector3(box3.max.x, box3.max.y, box3.max.z),
      new THREE.Vector3(box3.min.x, box3.max.y, box3.max.z),
    ];
    const corners2D = corners3D.map(toCanvasCoords);

    // Calculate the 2D bounding box from the projected canvas coordinates
    const minX = Math.min(...corners2D.map((corner) => corner.x));
    const maxX = Math.max(...corners2D.map((corner) => corner.x));
    const minY = Math.min(...corners2D.map((corner) => corner.y));
    const maxY = Math.max(...corners2D.map((corner) => corner.y));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
}
