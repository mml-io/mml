import {
  Interaction,
  MElement,
  MMLGraphicsInterface,
  radToDeg,
  StandaloneGraphicsAdapter,
} from "@mml-io/mml-web";
import {
  ThreeJSClickTrigger,
  ThreeJSGraphicsAdapter,
  ThreeJSGraphicsInterface,
  ThreeJSInteractionAdapter,
} from "@mml-io/mml-web-threejs";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";

import { CameraManager } from "./CameraManager";
import { CameraGraphics } from "./elements/Camera";
import { MCharacterController } from "./elements/CharacterController";
import { CollisionsManager } from "./elements/CollisionsManager";
import { MControl } from "./elements/Control";
import { ThreeJSDragFlyCameraControls } from "./ThreeJSDragFlyCameraControls";

type ControlRegistrationHandler = {
  addControl(control: MControl<GameThreeJSAdapter>): void;
  removeControl(control: MControl<GameThreeJSAdapter>): void;
};

export enum GameThreeJSAdapterControlsType {
  None,
  DragFly,
}

export type GameThreeJSAdapterOptions = {
  controlsType?: GameThreeJSAdapterControlsType;
  autoConnectRoot?: boolean;
};

export class GameThreeJSAdapter implements ThreeJSGraphicsAdapter, StandaloneGraphicsAdapter {
  collisionType: THREE.Object3D;
  containerType: THREE.Object3D;

  private rootContainer: THREE.Object3D<THREE.Object3DEventMap>;
  private threeScene: THREE.Scene;
  private overlayScene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private audioListener: THREE.AudioListener;
  private animationFrameCallback: () => void;
  private animationFrameRequest: number;
  private clickTrigger: ThreeJSClickTrigger;
  public controls: ThreeJSDragFlyCameraControls | null = null;

  // Postprocessing for outline highlighting
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private outlinePass: OutlinePass | null = null;
  private outputPass: OutputPass | null = null;
  private highlightedObjects: THREE.Object3D[] = [];

  private cameraManager = new CameraManager();
  private collisionsManager: CollisionsManager;

  private mmlControls: MControl<GameThreeJSAdapter>[] = [];
  private mmlCharacterControllers: MCharacterController<GameThreeJSAdapter>[] = [];
  private controlRegistrationHandler: ControlRegistrationHandler | null = null;
  private resizeHandler: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private constructor(
    private element: HTMLElement,
    private options: GameThreeJSAdapterOptions,
  ) {}

  public static async create(
    element: HTMLElement,
    options: GameThreeJSAdapterOptions,
  ): Promise<GameThreeJSAdapter> {
    const adapter = new GameThreeJSAdapter(element, options);
    await adapter.init();
    return adapter;
  }

  public interactionShouldShowDistance(interaction: Interaction<this>): number | null {
    return ThreeJSInteractionAdapter.interactionShouldShowDistance(
      interaction,
      this.cameraManager.getCamera(),
      this.threeScene,
    );
  }

  registerCamera(camera: CameraGraphics) {
    this.cameraManager.registerCamera(camera);
  }

  updateCameraPriority(camera: CameraGraphics) {
    this.cameraManager.updateCameraPriority(camera);
  }

  unregisterCamera(camera: CameraGraphics) {
    this.cameraManager.unregisterCamera(camera);
  }

  registerControl(control: MControl<GameThreeJSAdapter>) {
    this.mmlControls.push(control);
    this.controlRegistrationHandler?.addControl(control);
  }

  unregisterControl(control: MControl<GameThreeJSAdapter>) {
    this.mmlControls = this.mmlControls.filter((c) => c !== control);
    this.controlRegistrationHandler?.removeControl(control);
  }

  setControlRegistrationHandler(handler: ControlRegistrationHandler) {
    this.controlRegistrationHandler = handler;
    this.mmlControls.forEach((control) => handler.addControl(control));
  }

  registerCharacterController(controller: MCharacterController<GameThreeJSAdapter>) {
    this.mmlCharacterControllers.push(controller);
    this.cameraManager.registerCharacterController(controller);
  }

  unregisterCharacterController(controller: MCharacterController<GameThreeJSAdapter>) {
    const index = this.mmlCharacterControllers.indexOf(controller);
    if (index !== -1) {
      this.mmlCharacterControllers.splice(index, 1);
    }
    this.cameraManager.unregisterCharacterController(controller);
  }

  getThreeScene(): THREE.Scene {
    return this.threeScene;
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  getCanvasElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public getGraphicsAdapterFactory(): MMLGraphicsInterface<this> {
    return ThreeJSGraphicsInterface as MMLGraphicsInterface<this>;
  }

  async init(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.rootContainer = new THREE.Group();
      this.threeScene = new THREE.Scene();
      this.overlayScene = new THREE.Scene();
      this.threeScene.add(this.rootContainer);

      this.collisionsManager = new CollisionsManager(this.threeScene);

      // Create a proxy object that access the cameraManager.getCamera() for all properties
      const proxyCamera: THREE.PerspectiveCamera = new Proxy({} as THREE.PerspectiveCamera, {
        get: (target, prop) => {
          return this.cameraManager.getCamera()[prop as keyof THREE.PerspectiveCamera];
        },
        set: (target, prop, value) => {
          (this.cameraManager.getCamera() as any)[prop as keyof THREE.PerspectiveCamera] = value;
          return true;
        },
      });

      this.clickTrigger = ThreeJSClickTrigger.init(this.element, this.rootContainer, proxyCamera);

      this.renderer = this.createRenderer();

      // update camera aspect ratio with actual canvas dimensions
      const canvas = this.renderer.domElement;
      this.resize(canvas.clientWidth, canvas.clientHeight);

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
      this.threeScene.add(this.audioListener);

      THREE.Cache.enabled = true;

      this.setControlsType(this.options.controlsType);
      if (this.controls) {
        this.controls.enable();
      }

      // Setup postprocessing composer for outline effect (skip in jsdom)
      const isJsdom = navigator.userAgent.includes("jsdom");
      if (!isJsdom) {
        const width = this.renderer.domElement.clientWidth;
        const height = this.renderer.domElement.clientHeight;

        this.composer = new EffectComposer(this.renderer);
        this.composer.setPixelRatio(this.renderer.getPixelRatio());
        this.renderPass = new RenderPass(this.threeScene, this.getCamera());
        this.outlinePass = new OutlinePass(
          new THREE.Vector2(width, height),
          this.threeScene,
          this.getCamera(),
        );
        // Outline style similar to UE5 selection
        this.outlinePass.edgeStrength = 4.0;
        this.outlinePass.edgeGlow = 0.0;
        this.outlinePass.edgeThickness = 1.5;
        this.outlinePass.pulsePeriod = 0;
        this.outlinePass.visibleEdgeColor.set(0xffcc00);
        this.outlinePass.hiddenEdgeColor.set(0xffcc00);
        this.outlinePass.selectedObjects = this.highlightedObjects;

        this.composer.addPass(this.renderPass);
        this.composer.addPass(this.outlinePass);
        this.outputPass = new OutputPass();
        this.composer.addPass(this.outputPass);
      }

      this.resizeHandler = () => {
        const canvas = this.renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        this.resize(width, height);
      };

      window.addEventListener("resize", this.resizeHandler);

      // add resize observer to watch the canvas element directly
      // this catches UI layout changes like collapsing/expanding panes
      // on `/projects` route
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeHandler();
      });

      this.resizeObserver.observe(this.renderer.domElement);

      const clock = new THREE.Clock();
      this.animationFrameCallback = () => {
        this.animationFrameRequest = requestAnimationFrame(this.animationFrameCallback);
        if (this.controls) {
          this.controls.update(clock.getDelta());
        }

        const camera = this.getCamera();
        camera.aspect =
          this.renderer.domElement.clientWidth / this.renderer.domElement.clientHeight;
        camera.updateProjectionMatrix();
        if (
          this.composer &&
          this.renderPass &&
          this.outlinePass &&
          this.highlightedObjects.length > 0
        ) {
          // Ensure passes use the active camera
          this.renderPass.camera = camera;
          this.outlinePass.renderCamera = camera;
          // Keep composer resolution perfectly synced with renderer before rendering
          const size = new THREE.Vector2();
          this.renderer.getSize(size);
          this.composer.setSize(size.x, size.y);
          this.composer.setPixelRatio(this.renderer.getPixelRatio());
          this.outlinePass.setSize(size.x, size.y);
          this.composer.render();
        } else {
          this.renderer.render(this.threeScene, camera);
        }

        // Render overlay scene (gizmos, helpers) on top, unaffected by postprocessing
        this.renderer.autoClear = false;
        this.renderer.clearDepth();
        this.renderer.render(this.overlayScene, camera);
        this.renderer.autoClear = true;

        this.audioListener.position.copy(camera.position);
        this.audioListener.rotation.copy(camera.rotation);
      };
      this.element.appendChild(this.renderer.domElement);
      resolve();
    });
  }

  public setControlsType(type?: GameThreeJSAdapterControlsType) {
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }
    switch (type) {
      case GameThreeJSAdapterControlsType.None:
        break;
      case GameThreeJSAdapterControlsType.DragFly:
      default:
        this.controls = new ThreeJSDragFlyCameraControls(
          this.cameraManager.getDefaultCamera(),
          this.element,
          15.0,
          () => {
            return this.cameraManager.getCamera() === this.cameraManager.getDefaultCamera();
          },
        );
        break;
    }
    if (this.controls) {
      this.controls.enable();
    }
  }
  private createRenderer() {
    let renderer;
    if (navigator.userAgent.includes("jsdom")) {
      renderer = {
        domElement: document.createElement("canvas"),
        setSize: () => {
          // do nothing
        },
        render: () => {
          // do nothing
        },
      } as unknown as THREE.WebGLRenderer;
    } else {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    renderer.domElement.style.pointerEvents = "none";
    return renderer;
  }

  disconnectRoot() {
    if (this.rootContainer.parent) {
      this.rootContainer.parent.remove(this.rootContainer);
    }
  }

  connectRoot() {
    if (!this.rootContainer.parent) {
      this.threeScene.add(this.rootContainer);
    }
  }

  start() {
    this.animationFrameRequest = requestAnimationFrame(this.animationFrameCallback);
  }

  getUserPositionAndRotation() {
    if (this.mmlCharacterControllers.length > 0) {
      const controller = this.mmlCharacterControllers[0];
      const position = controller.getClientPredictedPosition();
      const rotation = controller.getClientPredictedRotation();

      return {
        position: {
          x: position.x,
          y: position.y,
          z: position.z,
        },
        rotation: { x: 0, y: radToDeg(rotation.ry), z: 0 },
      };
    }

    const camera = this.cameraManager.getCamera();
    const position = camera.position;
    const rotation = camera.rotation;

    return {
      position: {
        x: position.x,
        y: position.y,
        z: position.z,
      },
      rotation: {
        x: radToDeg(rotation.x),
        y: radToDeg(rotation.y),
        z: radToDeg(rotation.z),
      },
    };
  }

  public getAudioListener() {
    return this.audioListener;
  }

  resize(width: number, height: number) {
    this.cameraManager.resize(width, height);
    this.renderer.setSize(width, height);
    // Keep postprocessing in sync when size changes via fitContainer()
    if (this.composer) {
      this.composer.setSize(width, height);
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
    }
    if (this.outlinePass) {
      this.outlinePass.setSize(width, height);
    }
  }

  updateCanvasSize() {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    this.resize(width, height);
  }

  dispose() {
    this.clickTrigger.dispose();
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    cancelAnimationFrame(this.animationFrameRequest);
  }

  getRootContainer() {
    return this.rootContainer;
  }

  getCamera() {
    return this.cameraManager.getCamera();
  }

  getOverlayScene() {
    return this.overlayScene;
  }

  getCollisionsManager() {
    return this.collisionsManager;
  }

  public getBoundingBoxForElement(element: HTMLElement): {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null {
    const camera = this.cameraManager.getCamera();
    const renderer = this.renderer;

    if (!MElement.isMElement(element)) {
      return null;
    }

    const object = (element as MElement<ThreeJSGraphicsAdapter>).getContainer();

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

  // Outline highlight controls
  public setHighlightedObjects(objects: THREE.Object3D[]) {
    this.highlightedObjects.length = 0;
    objects.forEach((obj) => this.highlightedObjects.push(obj));
    if (this.outlinePass) {
      this.outlinePass.selectedObjects = this.highlightedObjects;
      // Ensure composer sizing is correct when enabling highlighting
      if (this.highlightedObjects.length > 0 && this.composer) {
        const canvas = this.renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        this.composer.setSize(width, height);
        this.composer.setPixelRatio(this.renderer.getPixelRatio());
        this.outlinePass.setSize(width, height);
      }
    }
  }

  public clearHighlightedObjects() {
    this.setHighlightedObjects([]);
  }

  public setOutlineParams(params: {
    color?: number | string;
    strength?: number;
    thickness?: number;
    glow?: number;
  }) {
    if (!this.outlinePass) return;
    if (params.color !== undefined) {
      this.outlinePass.visibleEdgeColor.set(params.color as any);
      this.outlinePass.hiddenEdgeColor.set(params.color as any);
    }
    if (params.strength !== undefined) this.outlinePass.edgeStrength = params.strength;
    if (params.thickness !== undefined) this.outlinePass.edgeThickness = params.thickness;
    if (params.glow !== undefined) this.outlinePass.edgeGlow = params.glow;
  }
}
