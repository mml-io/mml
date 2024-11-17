import {
  PlayCanvasClickTrigger,
  PlayCanvasGraphicsAdapter,
  PlayCanvasGraphicsInterface,
  PlayCanvasInteractionAdapter,
} from "@mml-io/mml-web-playcanvas";
import ammoWasmJs from "base64:./wasm/ammo.wasm.js";
import ammoWasmWasm from "base64:./wasm/ammo.wasm.wasm";
import dracoWasmJs from "base64:./wasm/draco.wasm.js";
import dracoWasmWasm from "base64:./wasm/draco.wasm.wasm";
import glslangWasmJs from "base64:./wasm/glslang.js";
import twgslWasmJs from "base64:./wasm/twgsl.js";
import { Interaction, Matr4, MMLGraphicsInterface, TransformableElement, Vect3 } from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasOrbitCameraControls } from "./controls";
import { PlayCanvasControls } from "./controls/PlayCanvasControls";
import { PlayCanvasDragFlyCameraControls } from "./controls/PlayCanvasDragFlyCameraControls";

export enum StandalonePlayCanvasAdapterControlsType {
  None,
  DragFly,
  Orbit,
}

export type StandalonePlayCanvasAdapterOptions = {
  controlsType?: StandalonePlayCanvasAdapterControlsType;
};

export class StandalonePlayCanvasAdapter implements PlayCanvasGraphicsAdapter {
  containerType: playcanvas.Entity;
  collisionType: playcanvas.Entity;

  private playcanvasApp: playcanvas.AppBase;

  public controls: PlayCanvasControls | null = null;
  private camera: playcanvas.Entity;
  private canvas: HTMLCanvasElement | null = null;

  private clickTrigger: PlayCanvasClickTrigger;

  private constructor(
    private element: HTMLElement,
    private options: StandalonePlayCanvasAdapterOptions,
  ) {}

  getPlayCanvasApp(): playcanvas.AppBase {
    return this.playcanvasApp;
  }

  getCamera(): playcanvas.Entity {
    return this.camera;
  }

  public getGraphicsAdapterFactory(): MMLGraphicsInterface<this> {
    return PlayCanvasGraphicsInterface as MMLGraphicsInterface<this>;
  }

  public static async create(
    element: HTMLElement,
    options: StandalonePlayCanvasAdapterOptions,
  ): Promise<StandalonePlayCanvasAdapter> {
    const adapter = new StandalonePlayCanvasAdapter(element, options);
    await adapter.init();
    return adapter;
  }

  public interactionShouldShowDistance(interaction: Interaction<this>): number | null {
    const cameraComponent = this.camera.camera;
    if (!cameraComponent) {
      console.error("Camera component not found");
      return null;
    }
    return PlayCanvasInteractionAdapter.interactionShouldShowDistance(
      interaction,
      this.camera,
      cameraComponent,
      this.playcanvasApp,
    );
  }

  async init() {
    playcanvas.WasmModule.setConfig("Ammo", {
      glueUrl: "data:text/javascript;base64," + ammoWasmJs,
      wasmUrl: "data:application/octet-stream;base64," + ammoWasmWasm,
    });
    await new Promise<void>((resolve) => {
      playcanvas.WasmModule.getInstance("Ammo", () => resolve());
    });

    playcanvas.WasmModule.setConfig("DracoDecoderModule", {
      glueUrl: "data:text/javascript;base64," + dracoWasmJs,
      wasmUrl: "data:application/wasm;base64," + dracoWasmWasm,
    });

    this.canvas = document.createElement("canvas");
    this.canvas.style.pointerEvents = "none";
    this.element.appendChild(this.canvas);

    this.playcanvasApp = new playcanvas.AppBase(this.canvas);

    const gfxOptions = {
      deviceTypes: ["webgpu", "webgl2"],
      glslangUrl: "data:text/javascript;base64," + glslangWasmJs,
      twgslUrl: "data:text/javascript;base64," + twgslWasmJs,
    };

    const soundManager = new playcanvas.SoundManager();
    const device = await playcanvas.createGraphicsDevice(this.canvas, gfxOptions);
    device.maxPixelRatio = window.devicePixelRatio;
    const createOptions = new playcanvas.AppOptions();
    createOptions.soundManager = soundManager;
    createOptions.graphicsDevice = device;
    createOptions.componentSystems = [
      playcanvas.RenderComponentSystem,
      playcanvas.CollisionComponentSystem,
      playcanvas.RigidBodyComponentSystem,
      playcanvas.CameraComponentSystem,
      playcanvas.LightComponentSystem,
      playcanvas.ModelComponentSystem,
      playcanvas.AnimComponentSystem,
      playcanvas.SoundComponentSystem,
      playcanvas.AudioListenerComponentSystem,
    ];
    createOptions.resourceHandlers = [
      playcanvas.AudioHandler,
      playcanvas.TextureHandler,
      playcanvas.ContainerHandler,
      playcanvas.ModelHandler,
      playcanvas.AnimationHandler,
    ];
    this.playcanvasApp.init(createOptions);

    this.playcanvasApp.setCanvasFillMode(playcanvas.FILLMODE_NONE);
    this.playcanvasApp.setCanvasResolution(playcanvas.RESOLUTION_FIXED);

    // Set the canvas size to non-zero to avoid errors on startup
    device.resizeCanvas(128, 128);

    this.camera = new playcanvas.Entity("camera", this.playcanvasApp);
    this.camera.addComponent("audiolistener");
    this.camera.addComponent("camera", {
      fov: 75,
      clearColor: new playcanvas.Color(1, 1, 1, 1),
    } as playcanvas.CameraComponent);
    this.camera.setPosition(0, 5, 10);
    this.playcanvasApp.root.addChild(this.camera);

    this.setControlsType(this.options.controlsType);

    this.clickTrigger = PlayCanvasClickTrigger.init(this.playcanvasApp, this.element, this.camera);

    this.playcanvasApp.on("update", (delta) => {
      if (this.controls) {
        this.controls.update(delta);
      }
    });

    this.playcanvasApp.start();
  }

  public setControlsType(type?: StandalonePlayCanvasAdapterControlsType) {
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }
    switch (type) {
      case StandalonePlayCanvasAdapterControlsType.None:
        break;
      case StandalonePlayCanvasAdapterControlsType.Orbit:
        this.controls = new PlayCanvasOrbitCameraControls(this.camera, this.element);
        break;
      case StandalonePlayCanvasAdapterControlsType.DragFly:
      default:
        this.controls = new PlayCanvasDragFlyCameraControls(this.camera, this.element);
        break;
    }
    if (this.controls) {
      this.controls.enable();
    }
  }

  public setCameraFOV(fov: number) {
    const cameraComponent = this.camera.camera;
    if (!cameraComponent) {
      console.error("Camera component not found");
      return null;
    }
    cameraComponent.fov = fov;
  }

  start() {}

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
    this.playcanvasApp.graphicsDevice.resizeCanvas(width, height);
  }

  dispose() {
    this.playcanvasApp.destroy();
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
    if (this.controls) {
      this.controls.dispose();
    }
    this.clickTrigger.dispose();
  }

  getRootContainer() {
    return this.playcanvasApp.root;
  }

  public getBoundingBoxForElement(element: HTMLElement): {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null {
    if (!(element instanceof TransformableElement)) {
      return null;
    }

    const bounds = element.getContentBounds();
    if (!bounds) {
      return null;
    }

    const camera = this.camera;
    const cameraComponent = camera.camera;
    if (!cameraComponent) {
      throw new Error("Camera component not found");
    }

    const renderer = this.playcanvasApp.graphicsDevice;
    const clientWidth = renderer.canvas.clientWidth;
    const clientHeight = renderer.canvas.clientHeight;

    // Custom function to convert 3D Vector3 to 2D canvas coordinates
    const toCanvasCoords = (point: Vect3) => {
      const vec = point
        .clone()
        .applyMatrix4(new Matr4(camera.getWorldTransform().clone().invert().data))
        .applyMatrix4(new Matr4(cameraComponent.projectionMatrix.data));
      vec.x = ((vec.x + 1) / 2) * clientWidth;
      vec.y = ((1 - vec.y) / 2) * clientHeight;
      return vec;
    };

    // Project the 3D bounding box corners into 2D canvas coordinates
    const corners3D = bounds.getCorners();
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
