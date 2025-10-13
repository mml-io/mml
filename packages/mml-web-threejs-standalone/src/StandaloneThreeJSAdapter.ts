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
  ThreeJSMemoryInspector,
  ThreeJSResourceManager,
} from "@mml-io/mml-web-threejs";
import * as THREE from "three";

import { ThreeJSControls } from "./controls/ThreeJSControls";
import { ThreeJSDragFlyCameraControls } from "./controls/ThreeJSDragFlyCameraControls";
import { ThreeJSOrbitCameraControls } from "./controls/ThreeJSOrbitCameraControls";

export enum StandaloneThreeJSAdapterControlsType {
  None,
  DragFly,
  Orbit,
}

export type StandaloneThreeJSAdapterOptions = {
  controlsType?: StandaloneThreeJSAdapterControlsType;
  autoConnectRoot?: boolean;
};

export class StandaloneThreeJSAdapter implements ThreeJSGraphicsAdapter, StandaloneGraphicsAdapter {
  collisionType: THREE.Object3D;
  containerType: THREE.Object3D;

  private rootContainer: THREE.Object3D<THREE.Object3DEventMap>;
  private threeScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private audioListener: THREE.AudioListener;
  private animationFrameCallback: () => void;
  private animationFrameRequest: number;
  private clickTrigger: ThreeJSClickTrigger;
  public controls: ThreeJSControls | null = null;
  private resourceManager = new ThreeJSResourceManager();

  private constructor(
    private element: HTMLElement,
    private options: StandaloneThreeJSAdapterOptions,
  ) {}

  public static async create(
    element: HTMLElement,
    options: StandaloneThreeJSAdapterOptions,
  ): Promise<StandaloneThreeJSAdapter> {
    const adapter = new StandaloneThreeJSAdapter(element, options);
    await adapter.init();
    return adapter;
  }

  public getResourceManager(): ThreeJSResourceManager {
    return this.resourceManager;
  }

  public interactionShouldShowDistance(interaction: Interaction<this>): number | null {
    return ThreeJSInteractionAdapter.interactionShouldShowDistance(
      interaction,
      this.camera,
      this.threeScene,
    );
  }

  getThreeScene(): THREE.Scene {
    return this.threeScene;
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  public setCameraFOV(fov: number) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  public getGraphicsAdapterFactory(): MMLGraphicsInterface<this> {
    return ThreeJSGraphicsInterface as MMLGraphicsInterface<this>;
  }

  async init(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.rootContainer = new THREE.Group();
      this.threeScene = new THREE.Scene();
      if (this.options.autoConnectRoot === undefined || this.options.autoConnectRoot) {
        this.threeScene.add(this.rootContainer);
      }

      this.camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.01,
        1000,
      );
      this.clickTrigger = ThreeJSClickTrigger.init(this.element, this.rootContainer, this.camera);

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

      this.setControlsType(this.options.controlsType);

      const clock = new THREE.Clock();
      this.animationFrameCallback = () => {
        this.animationFrameRequest = requestAnimationFrame(this.animationFrameCallback);
        if (this.controls) {
          this.controls.update(clock.getDelta());
        }
        this.renderer.render(this.threeScene, this.camera);
      };
      this.element.appendChild(this.renderer.domElement);
      resolve();
    });
  }

  public setControlsType(type?: StandaloneThreeJSAdapterControlsType) {
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }
    switch (type) {
      case StandaloneThreeJSAdapterControlsType.None:
        break;
      case StandaloneThreeJSAdapterControlsType.Orbit:
        this.controls = new ThreeJSOrbitCameraControls(this.camera, this.element);
        break;
      case StandaloneThreeJSAdapterControlsType.DragFly:
      default:
        this.controls = new ThreeJSDragFlyCameraControls(this.camera, this.element);
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
        setSize: () => void 0,
        render: () => void 0,
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

  public openMemoryReport() {
    ThreeJSMemoryInspector.openMemoryReport(this.threeScene);
  }

  public analyzeScene(): ReturnType<typeof ThreeJSMemoryInspector.analyzeScene> {
    return ThreeJSMemoryInspector.analyzeScene(this.threeScene);
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
    const position = this.camera.position;
    const rotation = this.camera.rotation;
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
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose() {
    this.clickTrigger.dispose();
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }
    cancelAnimationFrame(this.animationFrameRequest);
  }

  getRootContainer() {
    return this.rootContainer;
  }

  getCamera() {
    return this.camera;
  }

  public getBoundingBoxForElement(element: HTMLElement): {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null {
    const camera = this.camera;
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
}
