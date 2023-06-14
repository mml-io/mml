import * as THREE from "three";

import { Controls } from "./camera/Controls";
import { DragFlyCameraControls } from "./camera/DragFlyCameraControls";
import { PointerLockFlyCameraControls } from "./camera/PointerLockFlyCameraControls";
import { MElement } from "./elements";
import { Interaction } from "./elements/Interaction";
import { MixerContext } from "./html/HTMLMixer";
import { InteractionManager } from "./interaction-ui";
import { MMLClickTrigger } from "./MMLClickTrigger";
import { PromptManager } from "./prompt-ui";

export type ScenePosition = {
  location: { x: number; y: number; z: number };
  orientation: { x: number; y: number; z: number };
};

export type InteractionListener = {
  addInteraction(interaction: Interaction): void;
  updateInteraction(interaction: Interaction): void;
  removeInteraction(interaction: Interaction): void;
};

export type PromptProps = {
  message?: string;
  placeholder?: string;
  prefill?: string;
};

export type IMMLScene = {
  getAudioListener(): THREE.AudioListener;
  getRenderer(): THREE.Renderer;
  getThreeScene(): THREE.Scene;
  getCSSMixerContext(): MixerContext;
  getRootContainer(): THREE.Group;
  getCamera(): THREE.Camera;

  addCollider(collider: THREE.Object3D): void;
  updateCollider(collider: THREE.Object3D): void;
  removeCollider(collider: THREE.Object3D): void;

  addInteraction(interaction: Interaction): void;
  updateInteraction(interaction: Interaction): void;
  removeInteraction(interaction: Interaction): void;

  setControlsEnabled(enabled: boolean): void;
  getUserPosition(): ScenePosition;

  prompt: (promptProps: PromptProps, callback: (message: string | null) => void) => void;
};

export enum CameraType {
  DragFly,
  PointerLockFly,
}

export type MMLSceneOptions = {
  controlsType?: CameraType;
};

export class MMLScene implements IMMLScene {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly audioListener: THREE.AudioListener;
  private readonly threeScene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private readonly rootContainer: THREE.Group;
  private controls: Controls;
  private colliders = new Set<THREE.Object3D>();
  private interactions = new Set<Interaction>();
  private interactionListeners = new Set<InteractionListener>();
  private readonly css3dElement: HTMLElement;
  private readonly mixerContext: MixerContext;

  private initializedState: {
    animationFrameCallback: () => void;
    container: HTMLElement;
    resizeListener: () => void;
    clickTrigger: MMLClickTrigger;
    promptManager: PromptManager;
    interactionManager: InteractionManager;
  } | null = null;
  private resizeObserver: ResizeObserver;

  constructor(mmlSceneOptions: MMLSceneOptions = {}) {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.01,
      1000,
    );

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
    this.camera.position.z = 20;
    this.camera.position.y = 8;

    this.rootContainer = new THREE.Group();
    this.threeScene = new THREE.Scene();
    this.threeScene.add(this.rootContainer);

    this.mixerContext = new MixerContext(this.renderer, this.threeScene, this.camera);
    const css3dElement = this.mixerContext.rendererCss.domElement;
    css3dElement.style.width = "100%";
    css3dElement.style.height = "100%";
    this.css3dElement = css3dElement;

    THREE.Cache.enabled = true;

    this.resizeObserver = new ResizeObserver(() => {
      this.fitContainer();
    });
    this.resizeObserver.observe(this.css3dElement);

    switch (mmlSceneOptions.controlsType) {
      case CameraType.PointerLockFly:
        this.controls = new PointerLockFlyCameraControls(this.camera, this.css3dElement);
        break;
      case CameraType.DragFly:
      default:
        this.controls = new DragFlyCameraControls(this.camera, this.css3dElement);
        break;
    }
  }

  public getCSSMixerContext(): MixerContext {
    return this.mixerContext;
  }

  public getThreeScene(): THREE.Scene {
    return this.threeScene;
  }

  public getRenderer(): THREE.Renderer {
    return this.renderer;
  }

  public setControlsEnabled(enabled: boolean): void {
    if (enabled) {
      this.controls.enable();
    } else {
      this.controls.disable();
    }
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

  public getUserPosition(): ScenePosition {
    return {
      location: this.camera.position,
      orientation: {
        x: this.camera.rotation.x,
        y: this.camera.rotation.y,
        z: this.camera.rotation.z,
      },
    };
  }

  public init(container: HTMLElement, elementsHolder: HTMLElement) {
    if (this.initializedState) {
      console.error("MScene already initialized");
      return;
    }

    const clickTrigger = MMLClickTrigger.init(container, elementsHolder, this);
    const promptManager = PromptManager.init(container);
    const { interactionManager, interactionListener } = InteractionManager.init(
      container,
      this.camera,
      this.threeScene,
    );
    this.addInteractionListener(interactionListener);

    this.renderer = this.createRenderer();
    this.setControlsEnabled(true);

    const clock = new THREE.Clock();

    const animationFrameCallback = () => {
      requestAnimationFrame(animationFrameCallback);
      this.controls.update(clock.getDelta());
      this.renderer.render(this.threeScene, this.camera);
    };
    requestAnimationFrame(animationFrameCallback);

    const resizeListener = () => {
      this.fitContainer();
    };

    window.addEventListener("resize", resizeListener, false);

    this.initializedState = {
      animationFrameCallback,
      container,
      resizeListener,
      clickTrigger,
      promptManager,
      interactionManager,
    };
    container.appendChild(this.css3dElement);
    this.fitContainer();
  }

  private createRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0xffffff, 1);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.pointerEvents = "none";
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    this.css3dElement.appendChild(renderer.domElement);
    return renderer;
  }

  public fitContainer() {
    if (!this.initializedState) {
      console.error("MScene not initialized");
      return;
    }
    const container = this.initializedState.container;
    const width = container.clientWidth;
    const height = container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.mixerContext.rendererCss.setSize(width, height);
  }

  public dispose() {
    if (!this.initializedState) {
      console.error("MScene not initialized");
      return;
    }
    window.removeEventListener("resize", this.initializedState.resizeListener);
    this.resizeObserver.disconnect();
    this.rootContainer.clear();
    this.initializedState.clickTrigger.dispose();
    this.initializedState.promptManager.dispose();
    this.initializedState.interactionManager.dispose();
    this.initializedState = null;
  }

  public prompt(promptProps: PromptProps, callback: (message: string | null) => void) {
    if (!this.initializedState) {
      console.error("MScene not initialized");
      return;
    }
    const promptManager = this.initializedState.promptManager;
    promptManager.prompt(promptProps, callback);
  }

  public addCollider(collider: THREE.Object3D): void {
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
