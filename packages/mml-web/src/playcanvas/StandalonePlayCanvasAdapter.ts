import * as playcanvas from "playcanvas";

import { Ammo } from "./ammo.wasm.js";
import { PlayCanvasDragFlyCameraControls } from "./controls/PlayCanvasDragFlyCameraControls";
import { PlayCanvasClickTrigger } from "./PlayCanvasClickTrigger";
import { PlayCanvasGraphicsInterface } from "./PlayCanvasGraphicsInterface";
import { ControlsType, GraphicsAdapter, GraphicsAdapterOptions, IMMLScene } from "../MMLScene";

export class StandalonePlayCanvasAdapter implements GraphicsAdapter {
  private controls: PlayCanvasDragFlyCameraControls;
  private playcanvasApp: playcanvas.AppBase;
  private camera: playcanvas.Entity;
  private audioListener: playcanvas.AudioListener;
  private threeScene: playcanvas.Scene;
  private canvas: HTMLCanvasElement;
  private clickTrigger: PlayCanvasClickTrigger;

  private constructor(
    private element: HTMLElement,
    private mmlScene: IMMLScene,
    private options: GraphicsAdapterOptions,
  ) {}

  public static async create(
    element: HTMLElement,
    mmlScene: IMMLScene,
    options: GraphicsAdapterOptions,
  ): Promise<StandalonePlayCanvasAdapter> {
    const adapter = new StandalonePlayCanvasAdapter(element, mmlScene, options);
    await adapter.init();
    return adapter;
  }

  async init() {
    if (!window.Ammo) {
      console.log("Ammo not found, loading...");
      window.Ammo = await Ammo();
    }

    // TODO - Do Ammo using the below?
    // pc.WasmModule.setConfig('Ammo', {
    //     glueUrl: rootPath + '/static/lib/ammo/ammo.wasm.js',
    //     wasmUrl: rootPath + '/static/lib/ammo/ammo.wasm.wasm',
    //     fallbackUrl: rootPath + '/static/lib/ammo/ammo.js'
    // });
    // await new Promise((resolve) => {
    //     pc.WasmModule.getInstance('Ammo', () => resolve());
    // });

    this.canvas = document.createElement("canvas");
    this.canvas.style.pointerEvents = "none";
    this.element.appendChild(this.canvas);

    this.playcanvasApp = new playcanvas.AppBase(this.canvas);

    const gfxOptions = {
      deviceTypes: ["webgpu", "webgl2"],
      glslangUrl: "https://playcanvas.github.io/static/lib/glslang/glslang.js",
      twgslUrl: "https://playcanvas.github.io/static/lib/twgsl/twgsl.js",
    };

    const device = await playcanvas.createGraphicsDevice(this.canvas, gfxOptions);
    const createOptions = new playcanvas.AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.componentSystems = [
      playcanvas.RenderComponentSystem,
      playcanvas.CollisionComponentSystem,
      playcanvas.RigidBodyComponentSystem,
      playcanvas.CameraComponentSystem,
      playcanvas.LightComponentSystem,
      playcanvas.ModelComponentSystem,
    ];
    createOptions.resourceHandlers = [
      playcanvas.TextureHandler,
      playcanvas.ContainerHandler,
      playcanvas.ModelHandler,
    ];
    this.playcanvasApp.init(createOptions);
    this.playcanvasApp.setCanvasFillMode(playcanvas.FILLMODE_FILL_WINDOW);
    this.playcanvasApp.setCanvasResolution(playcanvas.RESOLUTION_AUTO);
    this.camera = new playcanvas.Entity("camera");
    this.camera.addComponent("camera", {
      fov: 75,
      clearColor: new playcanvas.Color(1, 1, 1),
    });
    this.playcanvasApp.root.addChild(this.camera);

    this.camera.setPosition(0, 5, 10);

    this.clickTrigger = PlayCanvasClickTrigger.init(
      this.playcanvasApp,
      this.element,
      this.mmlScene,
    );

    switch (this.options.controlsType) {
      case ControlsType.None:
        break;
      case ControlsType.DragFly:
      default:
        this.controls = new PlayCanvasDragFlyCameraControls(this.camera, this.element);
        break;
    }
    if (this.controls) {
      this.controls.enable();
    }

    this.playcanvasApp.on("update", (delta) => {
      if (this.controls) {
        this.controls.update(delta);
      }
    });
  }

  start() {
    this.playcanvasApp.start();
  }

  getUserPositionAndRotation() {
    const position = this.camera.getPosition();
    const rotation = this.camera.getEulerAngles();
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

  resize(width: number, height: number) {
    this.playcanvasApp.resizeCanvas(width, height);
  }

  dispose() {
    this.playcanvasApp.destroy();
    this.clickTrigger.dispose();
  }

  getRootContainer() {
    return this.playcanvasApp.root;
  }

  getCamera() {
    return this.camera;
  }

  getGraphicsAdapterFactory() {
    return PlayCanvasGraphicsInterface;
  }
}
