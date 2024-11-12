import {
  StandaloneThreeJSAdapter,
  StandaloneThreeJSAdapterControlsType,
  ThreeJSDragFlyCameraControls,
  ThreeJSOrbitCameraControls,
} from "@mml-io/mml-web-three-client";
import { HDRJPGLoader } from "@monogrid/gainmap-js";
import { parseColorAttribute } from "mml-web";
import * as THREE from "three";

import {
  connectGraphicsAdapterToFullScreenScene,
  FullScreenState,
} from "./ConnectGraphicsAdapterToFullScreenScene";
import { createFullscreenDiv } from "./CreateFullscreenDiv";
import { envMaps } from "./env-maps";
import { FormIteration } from "./FormIteration";
import { MMLSource } from "./MMLSource";
import { parseXYZ } from "./parseXYZ";
import {
  ambientLightColorField,
  ambientLightField,
  backgroundColorField,
  cameraFovField,
  cameraLookAtField,
  cameraModeField,
  cameraOrbitDistanceField,
  cameraOrbitPitchField,
  cameraOrbitSpeedField,
  cameraPositionField,
  environmentMapField,
} from "./ui/fields";

export class ThreeJSModeInternal {
  private disposed = false;
  private element: HTMLDivElement;
  private graphicsAdapter: StandaloneThreeJSAdapter | null = null;
  private fullScreen: FullScreenState | null = null;

  private ambientLight: THREE.AmbientLight | null = null;

  public readonly type = "three";
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
    this.graphicsAdapter = await StandaloneThreeJSAdapter.create(this.element, {
      controlsType: StandaloneThreeJSAdapterControlsType.DragFly,
    });
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

    const threeScene = this.graphicsAdapter.getThreeScene();
    const threeRenderer = this.graphicsAdapter.getRenderer();

    this.setBackgroundColor(formIteration, threeRenderer);
    this.setAmbientLight(formIteration, threeScene);
    this.setAmbientLightColor(formIteration);
    this.setEnvironmentMap(formIteration, threeRenderer, threeScene);

    this.setCameraMode(formIteration, this.graphicsAdapter);

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
      threeScene.background = envMap;
      threeScene.environment = envMap;
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

      let orbitDistance = parseFloat(formIteration.getFieldValue(cameraOrbitDistanceField));
      if (isNaN(orbitDistance)) {
        orbitDistance = 1;
      }
      controls.setDistance(orbitDistance);

      let orbitPitch = parseFloat(formIteration.getFieldValue(cameraOrbitPitchField));
      if (isNaN(orbitPitch)) {
        orbitPitch = 0;
      }
      controls.setPitchDegrees(orbitPitch);

      const lookAt = parseXYZ(formIteration.getFieldValue(cameraLookAtField));
      controls.setLookAt(lookAt[0], lookAt[1], lookAt[2]);
    } else if (cameraMode === "drag-fly") {
      if (graphicsAdapter.controls?.type !== "drag-fly") {
        graphicsAdapter.setControlsType(StandaloneThreeJSAdapterControlsType.DragFly);
      }
      const controls = graphicsAdapter.controls as ThreeJSDragFlyCameraControls;

      const cameraPosition = parseXYZ(formIteration.getFieldValue(cameraPositionField));
      controls.setCameraPosition(cameraPosition[0], cameraPosition[1], cameraPosition[2]);

      const lookAt = parseXYZ(formIteration.getFieldValue(cameraLookAtField));
      controls.setLookAt(lookAt[0], lookAt[1], lookAt[2]);
    } else if (cameraMode === "none" && graphicsAdapter.controls !== null) {
      graphicsAdapter.setControlsType(StandaloneThreeJSAdapterControlsType.None);
    }
  }
}
