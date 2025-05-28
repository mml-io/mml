import {
  FullScreenMMLScene,
  MMLNetworkSource,
  NetworkedDOMWebsocketStatus,
  NetworkedDOMWebsocketStatusToString,
  parseColorAttribute,
  StatusUI,
} from "@mml-io/mml-web";
import {
  PlayCanvasDragFlyCameraControls,
  PlayCanvasOrbitCameraControls,
  StandalonePlayCanvasAdapter,
  StandalonePlayCanvasAdapterControlsType,
} from "@mml-io/mml-web-playcanvas-standalone";
import * as playcanvas from "playcanvas";

import { calculateContentBounds } from "./calculateContentBounds";
import { applyCharacterAnimation } from "./characterAnimation";
import { envMaps } from "./env-maps";
import { FormIteration } from "./FormIteration";
import { MMLSourceDefinition } from "./MMLSourceDefinition";
import { parseXYZ } from "./parseXYZ";
import { setDebugGlobals } from "./setDebugGlobals";
import {
  ambientLightColorField,
  ambientLightField,
  backgroundColorField,
  cameraFitContents,
  cameraFovField,
  cameraLookAtField,
  cameraModeField,
  cameraOrbitDistanceField,
  cameraOrbitPitchField,
  cameraOrbitSpeedField,
  cameraPositionField,
  characterAnimationField,
  environmentMapField,
} from "./ui/fields";

export class PlayCanvasModeInternal {
  private disposed = false;
  public readonly type = "playcanvas";
  private environmentMap: string | null = null;

  private loadedState: {
    mmlNetworkSource: MMLNetworkSource;
    graphicsAdapter: StandalonePlayCanvasAdapter;
    fullScreenMMLScene: FullScreenMMLScene<StandalonePlayCanvasAdapter>;
    statusUI: StatusUI;
  } | null = null;

  constructor(
    private windowTarget: Window,
    private targetForWrappers: HTMLElement,
    private mmlSourceDefinition: MMLSourceDefinition,
    private formIteration: FormIteration,
  ) {
    this.init();
  }

  private async init() {
    const fullScreenMMLScene = new FullScreenMMLScene<StandalonePlayCanvasAdapter>();
    document.body.append(fullScreenMMLScene.element);
    const graphicsAdapter = await StandalonePlayCanvasAdapter.create(fullScreenMMLScene.element, {
      controlsType: StandalonePlayCanvasAdapterControlsType.DragFly,
    });

    if (this.disposed) {
      graphicsAdapter.dispose();
      return;
    }

    fullScreenMMLScene.init(graphicsAdapter);
    const statusUI = new StatusUI();
    const mmlNetworkSource = MMLNetworkSource.create({
      mmlScene: fullScreenMMLScene,
      statusUpdated: (status: NetworkedDOMWebsocketStatus) => {
        if (status === NetworkedDOMWebsocketStatus.Connected) {
          statusUI.setNoStatus();
        } else {
          statusUI.setStatus(NetworkedDOMWebsocketStatusToString(status));
        }
      },
      url: this.mmlSourceDefinition.url,
      windowTarget: this.windowTarget,
      targetForWrappers: this.targetForWrappers,
    });
    setDebugGlobals({
      mmlScene: fullScreenMMLScene,
      remoteDocumentWrapper: mmlNetworkSource.remoteDocumentWrapper,
    });
    const loadingCallback = () => {
      const [, completedLoading] = fullScreenMMLScene.getLoadingProgressManager().toRatio();
      if (completedLoading) {
        fullScreenMMLScene.getLoadingProgressManager().removeProgressCallback(loadingCallback);

        const fitContent = this.formIteration.getFieldValue(cameraFitContents);
        if (fitContent === "true") {
          graphicsAdapter.controls?.fitContent(calculateContentBounds(this.targetForWrappers));
        }

        this.applyCharacterAnimation(this.formIteration.getFieldValue(characterAnimationField));
      }
    };
    fullScreenMMLScene.getLoadingProgressManager().addProgressCallback(loadingCallback);
    this.loadedState = {
      mmlNetworkSource,
      graphicsAdapter,
      fullScreenMMLScene,
      statusUI,
    };
    this.update(this.formIteration);
  }

  update(formIteration: FormIteration) {
    this.formIteration = formIteration;
    if (!this.loadedState) {
      return;
    }

    const graphicsAdapter = this.loadedState.graphicsAdapter;
    const playcanvasScene = graphicsAdapter.getPlayCanvasApp().scene;
    const cameraEntity = graphicsAdapter.getCamera();
    const cameraComponent = cameraEntity.camera as playcanvas.CameraComponent;
    this.setBackgroundColor(formIteration, cameraComponent);
    this.setAmbientLight(formIteration, playcanvasScene);
    this.setEnvironmentMap(formIteration, graphicsAdapter.getPlayCanvasApp(), playcanvasScene);

    this.setCameraMode(formIteration, graphicsAdapter);
    this.applyCharacterAnimation(formIteration.getFieldValue(characterAnimationField));

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
      playcanvasScene.skyboxLuminance = 50000;
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
      playcanvasScene.ambientLuminance = ambientLightIntensity * 20;
      playcanvasScene.ambientLight = new playcanvas.Color(
        color.r * ambientLightIntensity * 20,
        color.g * ambientLightIntensity * 20,
        color.b * ambientLightIntensity * 20,
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
      r: 0,
      g: 0,
      b: 0,
      a: 0,
    });
    cameraComponent.clearColor = new playcanvas.Color(color.r, color.g, color.b, color.a);
  }

  private setCameraMode(
    formIteration: FormIteration,
    graphicsAdapter: StandalonePlayCanvasAdapter,
  ) {
    let cameraFOV = parseFloat(formIteration.getFieldValue(cameraFovField));
    if (isNaN(cameraFOV)) {
      cameraFOV = 75;
    }
    graphicsAdapter.setCameraFOV(cameraFOV);

    const cameraMode = formIteration.getFieldValue(cameraModeField);
    if (cameraMode === "orbit") {
      if (graphicsAdapter.controls?.type !== "orbit") {
        graphicsAdapter.setControlsType(StandalonePlayCanvasAdapterControlsType.Orbit);
      }
      const controls = graphicsAdapter.controls as PlayCanvasOrbitCameraControls;
      let orbitSpeed = parseFloat(formIteration.getFieldValue(cameraOrbitSpeedField));
      if (isNaN(orbitSpeed)) {
        orbitSpeed = 0;
      }
      controls.setDegreesPerSecond(orbitSpeed);
      let orbitPitch = parseFloat(formIteration.getFieldValue(cameraOrbitPitchField));

      if (isNaN(orbitPitch)) {
        orbitPitch = 0;
      }
      controls.setPitchDegrees(orbitPitch);

      const fitContent = formIteration.getFieldValue(cameraFitContents);
      if (fitContent === "true") {
        controls.fitContent(calculateContentBounds(this.targetForWrappers));
      } else {
        const lookAt = parseXYZ(formIteration.getFieldValue(cameraLookAtField));
        controls.setLookAt(lookAt[0], lookAt[1], lookAt[2]);

        let orbitDistance = parseFloat(formIteration.getFieldValue(cameraOrbitDistanceField));
        if (isNaN(orbitDistance)) {
          orbitDistance = 1;
        }
        controls.setDistance(orbitDistance);
      }
    } else if (cameraMode === "drag-fly") {
      if (graphicsAdapter.controls?.type !== "drag-fly") {
        graphicsAdapter.setControlsType(StandalonePlayCanvasAdapterControlsType.DragFly);
      }
      const controls = graphicsAdapter.controls as PlayCanvasDragFlyCameraControls;

      const cameraPosition = parseXYZ(formIteration.getFieldValue(cameraPositionField));
      controls.setCameraPosition(cameraPosition[0], cameraPosition[1], cameraPosition[2]);

      const lookAt = parseXYZ(formIteration.getFieldValue(cameraLookAtField));
      controls.setLookAt(lookAt[0], lookAt[1], lookAt[2]);

      const fitContent = formIteration.getFieldValue(cameraFitContents);
      if (fitContent === "true") {
        controls.fitContent(calculateContentBounds(this.targetForWrappers));
      }
    } else if (cameraMode === "none" && graphicsAdapter.controls !== null) {
      graphicsAdapter.setControlsType(StandalonePlayCanvasAdapterControlsType.None);
    }
  }

  private applyCharacterAnimation(animation: string) {
    // This is the root tag of the MML scene
    const mmlRoot =
      this.loadedState?.mmlNetworkSource.remoteDocumentWrapper.remoteDocument.children[0]
        ?.children[0];

    if (mmlRoot) {
      applyCharacterAnimation(mmlRoot, animation);
    }
  }

  public dispose() {
    this.disposed = true;
    if (this.loadedState) {
      this.loadedState.mmlNetworkSource.dispose();
      this.loadedState.graphicsAdapter.dispose();
      this.loadedState.fullScreenMMLScene.dispose();
      this.loadedState.statusUI.dispose();
      this.loadedState = null;
    }
  }
}
