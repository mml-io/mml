import * as THREE from "three";

import { ThreeJSDragFlyCameraControls } from "./controls/ThreeJSDragFlyCameraControls";
import { ThreeJSPointerLockFlyCameraControls } from "./controls/ThreeJSPointerLockFlyCameraControls";
import { ThreeJSClickTrigger } from "./ThreeJSClickTrigger";
import { ThreeJSGraphicsInterface } from "./ThreeJSGraphicsInterface";
import { Controls } from "../camera/Controls";
import { ControlsType, GraphicsAdapter, GraphicsAdapterOptions, IMMLScene } from "../MMLScene";

export class StandaloneThreeJSAdapter implements GraphicsAdapter {
  private rootContainer: THREE.Group<THREE.Object3DEventMap>;
  private threeScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private audioListener: THREE.AudioListener;
  private controls: Controls;
  private animationFrameCallback: () => void;
  private animationFrameRequest: number;
  private clickTrigger: ThreeJSClickTrigger;

  private constructor(
    private element: HTMLElement,
    private mmlScene: IMMLScene,
    private options: GraphicsAdapterOptions,
  ) {
    this.clickTrigger = ThreeJSClickTrigger.init(this.element, mmlScene);
  }

  public static async create(
    element: HTMLElement,
    mmlScene: IMMLScene,
    options: GraphicsAdapterOptions,
  ): Promise<StandaloneThreeJSAdapter> {
    const adapter = new StandaloneThreeJSAdapter(element, mmlScene, options);
    await adapter.init();
    return adapter;
  }

  async init(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.rootContainer = new THREE.Group();
      this.threeScene = new THREE.Scene();
      this.threeScene.add(this.rootContainer);

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

      switch (this.options.controlsType) {
        case ControlsType.None:
          break;
        case ControlsType.PointerLockFly:
          this.controls = new ThreeJSPointerLockFlyCameraControls(this.camera, this.element);
          break;
        case ControlsType.DragFly:
        default:
          this.controls = new ThreeJSDragFlyCameraControls(this.camera, this.element);
          break;
      }
      if (this.controls) {
        this.controls.enable();
      }

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
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
      },
    };
  }

  // TODO - this should be on an interface that is present even when not in standalone mode
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
    cancelAnimationFrame(this.animationFrameRequest);
  }

  getRootContainer() {
    return this.rootContainer;
  }

  getCamera() {
    return this.camera;
  }

  getGraphicsAdapterFactory() {
    return ThreeJSGraphicsInterface;
  }
}
