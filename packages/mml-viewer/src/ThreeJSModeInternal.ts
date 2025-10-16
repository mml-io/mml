import {
  FullScreenMMLScene,
  MMLNetworkSource,
  NetworkedDOMWebsocketStatus,
  NetworkedDOMWebsocketStatusToString,
  parseColorAttribute,
  StatusUI,
} from "@mml-io/mml-web";
import {
  StandaloneThreeJSAdapter,
  StandaloneThreeJSAdapterControlsType,
  ThreeJSDragFlyCameraControls,
  ThreeJSOrbitCameraControls,
} from "@mml-io/mml-web-threejs-standalone";
import { HDRJPGLoader } from "@monogrid/gainmap-js";
import * as THREE from "three";

import { calculateContentBounds } from "./calculateContentBounds";
import { applyCharacterAnimation } from "./characterAnimation";
import { envMaps } from "./env-maps";
import { FormIteration } from "./FormIteration";
import { MMLSourceDefinition } from "./MMLSourceDefinition";
import { parseXYZ } from "./parseXYZ";
import { setDebugGlobals } from "./setDebugGlobals";
import { FieldDefinition } from "./ui/FieldDefinition";
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
  developerGroup,
  environmentMapField,
  showEnvironmentMapField,
} from "./ui/fields";

export type ThreeJSModeOptions = {
  showDebugLoading?: boolean;
  hideUntilLoaded?: boolean;
  loadingStyle?: "bar" | "spinner";
};

export class ThreeJSModeInternal {
  private disposed = false;

  private loadedState: {
    mmlNetworkSource: MMLNetworkSource;
    graphicsAdapter: StandaloneThreeJSAdapter;
    fullScreenMMLScene: FullScreenMMLScene<StandaloneThreeJSAdapter>;
    statusUI: StatusUI;
  } | null = null;

  private ambientLight: THREE.AmbientLight | null = null;

  public readonly type = "three";
  private environmentMap: string | null = null;

  constructor(
    private windowTarget: Window,
    private targetForWrappers: HTMLElement,
    private mmlSourceDefinition: MMLSourceDefinition,
    private formIteration: FormIteration,
    private options: ThreeJSModeOptions,
  ) {
    this.init();
  }

  public updateSource(source: MMLSourceDefinition): void {
    this.mmlSourceDefinition = source;
    if (this.loadedState) {
      if (this.options.hideUntilLoaded) {
        this.loadedState.graphicsAdapter.disconnectRoot();
      }
      const existingSource = this.loadedState.mmlNetworkSource;
      existingSource.dispose();

      const mmlNetworkSource = this.createSource(
        this.mmlSourceDefinition,
        this.loadedState.statusUI,
        this.loadedState.fullScreenMMLScene,
        this.loadedState.graphicsAdapter,
      );
      this.loadedState.mmlNetworkSource = mmlNetworkSource;
      this.loadedState.fullScreenMMLScene.resetLoadingProgressBar();
    }
  }

  private createSource(
    source: MMLSourceDefinition,
    statusUI: StatusUI,
    fullScreenMMLScene: FullScreenMMLScene<StandaloneThreeJSAdapter>,
    graphicsAdapter: StandaloneThreeJSAdapter,
  ): MMLNetworkSource {
    const mmlNetworkSource = MMLNetworkSource.create({
      mmlScene: fullScreenMMLScene,
      statusUpdated: (status: NetworkedDOMWebsocketStatus) => {
        if (status === NetworkedDOMWebsocketStatus.Connected) {
          statusUI.setNoStatus();
        } else {
          statusUI.setStatus(NetworkedDOMWebsocketStatusToString(status));
        }
      },
      url: source.url,
      windowTarget: this.windowTarget,
      targetForWrappers: this.targetForWrappers,
    });
    setDebugGlobals({
      mmlScene: fullScreenMMLScene,
      remoteDocumentWrapper: mmlNetworkSource.remoteDocumentWrapper,
    });
    const loadingCallback = () => {
      const [, completedLoading] = fullScreenMMLScene.getLoadingProgressManager().toRatio();

      /*
       Attempt to apply the character animation as soon as the possible element exists so that the animation
       counts towards the loading progress.
      */
      this.applyCharacterAnimation(this.formIteration.getFieldValue(characterAnimationField));
      if (completedLoading) {
        fullScreenMMLScene.getLoadingProgressManager().removeProgressCallback(loadingCallback);

        if (this.options.hideUntilLoaded) {
          requestAnimationFrame(() => {
            this.loadedState?.graphicsAdapter.connectRoot();
          });
        }

        const fitContent = this.formIteration.getFieldValue(cameraFitContents);
        if (fitContent === "true") {
          graphicsAdapter.controls?.fitContent(calculateContentBounds(this.targetForWrappers));
        }
      }
    };
    fullScreenMMLScene.getLoadingProgressManager().addProgressCallback(loadingCallback);
    return mmlNetworkSource;
  }

  private async init() {
    const fullScreenMMLScene = new FullScreenMMLScene<StandaloneThreeJSAdapter>({
      showDebugLoading: this.options.showDebugLoading,
      loadingStyle: this.options.loadingStyle,
    });
    document.body.append(fullScreenMMLScene.element);
    const graphicsAdapter = await StandaloneThreeJSAdapter.create(fullScreenMMLScene.element, {
      controlsType: StandaloneThreeJSAdapterControlsType.DragFly,
      autoConnectRoot: !this.options.hideUntilLoaded,
    });
    if (this.disposed) {
      graphicsAdapter.dispose();
      return;
    }

    fullScreenMMLScene.init(graphicsAdapter);
    const statusUI = new StatusUI();

    const mmlNetworkSource = this.createSource(
      this.mmlSourceDefinition,
      statusUI,
      fullScreenMMLScene,
      graphicsAdapter,
    );

    fullScreenMMLScene.getLoadingProgressManager().setInitialLoad(true);

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
    const threeScene = graphicsAdapter.getThreeScene();
    const threeRenderer = graphicsAdapter.getRenderer();

    this.setBackgroundColor(formIteration, threeRenderer);
    this.setAmbientLight(formIteration, threeScene);
    this.setAmbientLightColor(formIteration);
    this.setEnvironmentMap(formIteration, threeRenderer, threeScene);

    this.setCameraMode(formIteration, graphicsAdapter);
    this.applyCharacterAnimation(formIteration.getFieldValue(characterAnimationField));

    const openMemoryReportField: FieldDefinition = {
      name: "openMemoryReport",
      label: "Open Memory Report",
      type: "action",
      defaultValue: "",
      groupDefinition: developerGroup,
      onClick: () => {
        try {
          this.loadedState?.graphicsAdapter.openMemoryReport();
        } catch (e) {
          console.warn("Failed to open memory report:", e);
        }
      },
    };
    formIteration.getFieldValue(openMemoryReportField);

    formIteration.completed();
  }

  private setEnvironmentMap(
    formIteration: FormIteration,
    threeRenderer: THREE.WebGLRenderer,
    threeScene: THREE.Scene,
  ) {
    let environmentMap = formIteration.getFieldValue(environmentMapField);
    const foundEnvMap = envMaps[environmentMap];
    if (foundEnvMap) {
      environmentMap = foundEnvMap.url;
    }
    if (!environmentMap) {
      threeScene.environment = null;
      threeScene.background = null;
      this.environmentMap = null;
      return;
    }
    if (environmentMap === this.environmentMap) {
      return;
    }

    const pmremGenerator = new THREE.PMREMGenerator(threeRenderer);
    const loader = new HDRJPGLoader(threeRenderer);
    loader.loadAsync(environmentMap).then((result) => {
      const hdrJpg = result.renderTarget.texture;
      hdrJpg.mapping = THREE.EquirectangularReflectionMapping;

      const envMap = pmremGenerator.fromEquirectangular(hdrJpg).texture;
      threeScene.backgroundIntensity = 1;
      threeScene.backgroundBlurriness = 0;
      threeScene.backgroundRotation = new THREE.Euler(0, -Math.PI / 2, 0);
      threeScene.environment = envMap;

      console.log("showEnvironmentMapField", formIteration.getFieldValue(showEnvironmentMapField));
      if (formIteration.getFieldValue(showEnvironmentMapField) === "true") {
        threeScene.background = envMap;
      } else {
        console.log("setting background to null");
        threeScene.background = null;
      }
      
      result.dispose();
    });
  }

  private setAmbientLightColor(formIteration: FormIteration) {
    const ambientLightColorString = formIteration.getFieldValue(ambientLightColorField);
    const color = parseColorAttribute(ambientLightColorString, {
      r: 1,
      g: 1,
      b: 1,
    });
    if (this.ambientLight) {
      this.ambientLight.color.setRGB(color.r, color.g, color.b);
    }
  }

  private setAmbientLight(formIteration: FormIteration, threeScene: THREE.Scene) {
    const ambientLightIntensityString = formIteration.getFieldValue(ambientLightField);
    let ambientLightIntensity = parseFloat(ambientLightIntensityString);
    if (isNaN(ambientLightIntensity)) {
      ambientLightIntensity = 0;
    }
    if (ambientLightIntensity < 0) {
      ambientLightIntensity = 0;
    }
    if (this.ambientLight && ambientLightIntensity <= 0) {
      this.ambientLight.removeFromParent();
      this.ambientLight = null;
    }
    if (!this.ambientLight && ambientLightIntensity > 0) {
      this.ambientLight = new THREE.AmbientLight(0xffffff, ambientLightIntensity);
      threeScene.add(this.ambientLight);
    } else if (this.ambientLight) {
      this.ambientLight.intensity = ambientLightIntensity;
    }
  }

  private setBackgroundColor(formIteration: FormIteration, threeRenderer: THREE.WebGLRenderer) {
    const backgroundColorString = formIteration.getFieldValue(backgroundColorField);
    const color = parseColorAttribute(backgroundColorString, {
      r: 1,
      g: 1,
      b: 1,
      a: 0,
    });
    threeRenderer.setClearColor(new THREE.Color(color.r, color.g, color.b), color.a);
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

  private setCameraMode(formIteration: FormIteration, graphicsAdapter: StandaloneThreeJSAdapter) {
    let cameraFOV = parseFloat(formIteration.getFieldValue(cameraFovField));
    if (isNaN(cameraFOV)) {
      cameraFOV = 75;
    }
    graphicsAdapter.setCameraFOV(cameraFOV);

    const cameraMode = formIteration.getFieldValue(cameraModeField);
    if (cameraMode === "orbit") {
      if (graphicsAdapter.controls?.type !== "orbit") {
        graphicsAdapter.setControlsType(StandaloneThreeJSAdapterControlsType.Orbit);
      }
      const controls = graphicsAdapter.controls as ThreeJSOrbitCameraControls;
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
        graphicsAdapter.setControlsType(StandaloneThreeJSAdapterControlsType.DragFly);
      }
      const controls = graphicsAdapter.controls as ThreeJSDragFlyCameraControls;

      const cameraPosition = parseXYZ(formIteration.getFieldValue(cameraPositionField));
      controls.setCameraPosition(cameraPosition[0], cameraPosition[1], cameraPosition[2]);

      const lookAt = parseXYZ(formIteration.getFieldValue(cameraLookAtField));
      controls.setLookAt(lookAt[0], lookAt[1], lookAt[2]);

      const fitContent = formIteration.getFieldValue(cameraFitContents);
      if (fitContent === "true") {
        controls.fitContent(calculateContentBounds(this.targetForWrappers));
      }
    } else if (cameraMode === "none" && graphicsAdapter.controls !== null) {
      graphicsAdapter.setControlsType(StandaloneThreeJSAdapterControlsType.None);
    }
  }

  private applyCharacterAnimation(animation: string): boolean {
    // This is the root tag of the MML scene
    const mmlRoot =
      this.loadedState?.mmlNetworkSource.remoteDocumentWrapper.remoteDocument.children[0]
        ?.children[0];

    if (mmlRoot) {
      return applyCharacterAnimation(mmlRoot, animation);
    }
    return false;
  }
}
