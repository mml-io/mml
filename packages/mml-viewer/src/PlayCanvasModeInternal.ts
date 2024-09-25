import { StandalonePlayCanvasAdapter } from "@mml-io/mml-web-playcanvas-client";
import { parseColorAttribute } from "mml-web";
import * as playcanvas from "playcanvas";

import {
  connectGraphicsAdapterToFullScreenScene,
  FullScreenState,
} from "./ConnectGraphicsAdapterToFullScreenScene";
import { createFullscreenDiv } from "./CreateFullscreenDiv";
import { envMaps } from "./env-maps";
import { FormIteration } from "./FormIteration";
import { MMLSource } from "./MMLSource";
import {
  ambientLightColorField,
  ambientLightField,
  backgroundColorField,
  environmentMapField,
} from "./ui/fields";

export class PlayCanvasModeInternal {
  private disposed = false;
  private element: HTMLDivElement;
  private graphicsAdapter: StandalonePlayCanvasAdapter | null = null;
  private fullScreen: FullScreenState | null = null;

  public readonly type = "playcanvas";
  private environmentMap: string | null = null;

  constructor(
    private windowTarget: Window,
    private targetForWrappers: HTMLElement,
    private mmlSource: MMLSource,
    private formIteration: FormIteration,
  ) {
    this.element = createFullscreenDiv();
    this.init();
  }

  private async init() {
    this.graphicsAdapter = await StandalonePlayCanvasAdapter.create(this.element);

    if (this.disposed) {
      this.dispose();
      return;
    }

    this.fullScreen = connectGraphicsAdapterToFullScreenScene({
      element: this.element,
      graphicsAdapter: this.graphicsAdapter,
      source: this.mmlSource,
      windowTarget: this.windowTarget,
      targetForWrappers: this.targetForWrappers,
    });
    this.update(this.formIteration);
  }

  update(formIteration: FormIteration) {
    this.formIteration = formIteration;
    if (!this.graphicsAdapter) {
      return;
    }

    const playcanvasScene = this.graphicsAdapter.getPlayCanvasApp().scene;
    const cameraEntity = this.graphicsAdapter.getCamera();
    const cameraComponent = cameraEntity.camera as playcanvas.CameraComponent;
    this.setBackgroundColor(formIteration, cameraComponent);
    this.setAmbientLight(formIteration, playcanvasScene);
    this.setEnvironmentMap(formIteration, this.graphicsAdapter.getPlayCanvasApp(), playcanvasScene);

    formIteration.completed();
  }

  private setEnvironmentMap(
    formIteration: FormIteration,
    playCanvasApp: playcanvas.AppBase,
    playcanvasScene: playcanvas.Scene,
  ) {
    let environmentMap = formIteration.getFieldValue(environmentMapField);
    const foundEnvMap = envMaps[environmentMap];
    if (foundEnvMap) {
      environmentMap = foundEnvMap.url;
    }
    if (!environmentMap) {
      // @ts-expect-error - PlayCanvas types don't accept null, but it works
      playcanvasScene.envAtlas = null;
      // @ts-expect-error - PlayCanvas types don't accept null, but it works
      playcanvasScene.skybox = null;
      this.environmentMap = null;
      return;
    }
    if (environmentMap === this.environmentMap) {
      return;
    }

    const envMapAsset = new playcanvas.Asset("env-atlas", "texture", { url: environmentMap });
    playCanvasApp.assets.add(envMapAsset);
    playCanvasApp.assets.load(envMapAsset);

    const onEnvMapAssetLoad = (texture: playcanvas.Texture) => {
      const skybox = playcanvas.EnvLighting.generateSkyboxCubemap(texture);
      const lighting = playcanvas.EnvLighting.generateLightingSource(texture);
      const envAtlas = playcanvas.EnvLighting.generateAtlas(lighting, {});
      lighting.destroy();
      playcanvasScene.envAtlas = envAtlas;
      playcanvasScene.skybox = skybox;
    };

    if (envMapAsset.loaded) {
      onEnvMapAssetLoad(envMapAsset.resource);
    } else {
      envMapAsset.on("load", (envMapAsset: playcanvas.Asset) => {
        onEnvMapAssetLoad(envMapAsset.resource);
      });
    }
  }

  private setAmbientLight(formIteration: FormIteration, playcanvasScene: playcanvas.Scene) {
    const ambientLightIntensityString = formIteration.getFieldValue(ambientLightField) || "0";
    const ambientLightColorString = formIteration.getFieldValue(ambientLightColorField);
    let ambientLightIntensity = parseFloat(ambientLightIntensityString);
    if (isNaN(ambientLightIntensity)) {
      ambientLightIntensity = 0;
    }
    if (ambientLightIntensity < 0) {
      playcanvasScene.ambientLuminance = 0;
      playcanvasScene.ambientLight = new playcanvas.Color(0, 0, 0);
    } else {
      const color = parseColorAttribute(ambientLightColorString, {
        r: 1,
        g: 1,
        b: 1,
      });
      playcanvasScene.ambientLuminance = ambientLightIntensity;
      playcanvasScene.ambientLight = new playcanvas.Color(
        color.r * ambientLightIntensity,
        color.g * ambientLightIntensity,
        color.b * ambientLightIntensity,
      );
    }
  }

  private setBackgroundColor(
    formIteration: FormIteration,
    cameraComponent: playcanvas.CameraComponent,
  ) {
    const backgroundColor = formIteration.getFieldValue(backgroundColorField);
    if (!backgroundColor) {
      cameraComponent.clearColor = new playcanvas.Color(0, 0, 0, 0);
      return;
    }
    const color = parseColorAttribute(backgroundColor, {
      r: 255,
      g: 255,
      b: 255,
      a: 0,
    });
    cameraComponent.clearColor = new playcanvas.Color(color.r, color.g, color.b, color.a);
  }

  dispose() {
    this.disposed = true;
    if (this.fullScreen) {
      this.fullScreen.dispose();
      this.fullScreen = null;
    }
    if (this.graphicsAdapter) {
      this.graphicsAdapter.dispose();
      this.graphicsAdapter = null;
    }
    this.element.remove();
  }
}
