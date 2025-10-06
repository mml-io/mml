import {
  AnimatedAttributeHelper,
  AnimationType,
  AttributeHandler,
  floatParser,
  MElement,
  MMLScene,
} from "@mml-io/mml-web";
import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";

import { GameThreeJSAdapter } from "../GameThreeJSAdapter";

const defaultIntensity = 1.2;
const defaultAzimuthalAngle = 180.0;
const defaultPolarAngle = -45.0;
const defaultPriority = 1;
const defaultResolution = 2048;
const defaultFrustum = 50;

const defaultColor = "#ffffff";

const defaultTurbidity = 1.2;
const defaultRayleigh = 0.7;
const defaultMieCoefficient = 0.02;
const defaultMieDirectionalG = 0.99;

export type MSunProps = {
  intensity: number;
  priority: number;
  color: string;
  azimuthalAngle: number;
  polarAngle: number;
  resolution: number;
  frustum: number;
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
};

export class SunGraphics {
  scene: MMLScene<GameThreeJSAdapter>;
  threeScene: THREE.Scene;
  priority: number;

  private sunGroup: THREE.Group;
  private directionalLight: THREE.DirectionalLight;
  private shadowCamera: THREE.OrthographicCamera;
  private cameraHelper: THREE.CameraHelper | null = null;

  private sky: Sky | null = null;
  private skyCubeCamera: THREE.CubeCamera | null = null;
  private skyRenderTarget: THREE.WebGLCubeRenderTarget | null = null;

  private target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private debug: boolean = false;

  constructor(public sunElement: MSun<GameThreeJSAdapter>) {
    this.scene = sunElement.getScene() as MMLScene<GameThreeJSAdapter>;
    this.threeScene = this.scene.getGraphicsAdapter().getThreeScene();
    this.priority = sunElement.props.priority;

    this.scene.getGraphicsAdapter().registerSun(this);
    this.createSun();
    this.createSkyShader();
  }

  private createSun() {
    const { resolution, frustum, intensity, color } = this.sunElement.props;

    this.sunGroup = new THREE.Group();

    this.shadowCamera = new THREE.OrthographicCamera(
      -frustum,
      frustum,
      frustum,
      -frustum,
      0.1,
      200,
    );

    this.directionalLight = new THREE.DirectionalLight(color, intensity);
    this.directionalLight.shadow.normalBias = 0.1;
    this.directionalLight.shadow.radius = 0.02;
    this.directionalLight.shadow.camera = this.shadowCamera;
    this.directionalLight.shadow.mapSize.set(resolution, resolution);
    this.directionalLight.castShadow = true;

    if (this.debug) {
      this.cameraHelper = new THREE.CameraHelper(this.shadowCamera);
      this.sunGroup.add(this.cameraHelper);
    }

    this.sunGroup.add(this.directionalLight);
    this.updateSunPosition();
  }

  private createSkyShader() {
    this.sky = new Sky();
    this.sky.scale.setScalar(50000);

    this.updateSkyShaderValues();

    this.skyRenderTarget = new THREE.WebGLCubeRenderTarget(512, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });

    this.skyCubeCamera = new THREE.CubeCamera(1, 1.1, this.skyRenderTarget);
  }

  private updateSkyShaderValues() {
    if (!this.sky) return;

    const { azimuthalAngle, polarAngle, turbidity, rayleigh, mieCoefficient, mieDirectionalG } =
      this.sunElement.props;

    const polarRad = THREE.MathUtils.degToRad(polarAngle);
    const azimuthalRad = THREE.MathUtils.degToRad(azimuthalAngle);
    const sunPosition = new THREE.Vector3().setFromSphericalCoords(1, polarRad, azimuthalRad);

    this.sky.material.uniforms.sunPosition.value = sunPosition;
    this.sky.material.uniforms.turbidity.value = turbidity;
    this.sky.material.uniforms.rayleigh.value = rayleigh;
    this.sky.material.uniforms.mieCoefficient.value = mieCoefficient;
    this.sky.material.uniforms.mieDirectionalG.value = mieDirectionalG;
  }

  private updateSunPosition() {
    const { azimuthalAngle, polarAngle } = this.sunElement.props;

    const distance = 100;
    const polarRad = THREE.MathUtils.degToRad(polarAngle);
    const azimuthalRad = THREE.MathUtils.degToRad(azimuthalAngle);

    const adjustedAzimuthalAngle = -azimuthalRad + Math.PI / 2;

    const sphericalPosition = new THREE.Vector3(
      distance * Math.sin(polarRad) * Math.cos(adjustedAzimuthalAngle),
      distance * Math.cos(polarRad),
      distance * Math.sin(polarRad) * Math.sin(adjustedAzimuthalAngle),
    );

    const newSunPosition = this.target.clone().add(sphericalPosition);
    this.directionalLight.position.copy(newSunPosition);
    this.directionalLight.target.position.copy(this.target);
    this.directionalLight.target.updateMatrixWorld();
  }

  setIntensity(intensity: number) {
    this.directionalLight.intensity = intensity;
    this.scene.getGraphicsAdapter().updateSunProperties();
  }

  setColor(color: string) {
    this.directionalLight.color.set(color);
    this.scene.getGraphicsAdapter().updateSunProperties();
  }

  setAzimuthalAngle(_angle: number) {
    this.updateSunPosition();
    this.updateSkyShaderValues();
    this.scene.getGraphicsAdapter().updateSunProperties();
  }

  setPolarAngle(_angle: number) {
    this.updateSunPosition();
    this.updateSkyShaderValues();
    this.scene.getGraphicsAdapter().updateSunProperties();
  }

  setResolution(resolution: number) {
    this.directionalLight.shadow.mapSize.set(resolution, resolution);
    this.scene.getGraphicsAdapter().updateSunProperties();
  }

  setFrustum(frustum: number) {
    this.shadowCamera.left = -frustum;
    this.shadowCamera.right = frustum;
    this.shadowCamera.top = frustum;
    this.shadowCamera.bottom = -frustum;
    this.shadowCamera.updateProjectionMatrix();
    this.scene.getGraphicsAdapter().updateSunProperties();
  }

  setTurbidity(_turbidity: number) {
    this.updateSkyShaderValues();
    this.scene.getGraphicsAdapter().updateSunProperties();
  }

  setRayleigh(_rayleigh: number) {
    this.updateSkyShaderValues();
    this.scene.getGraphicsAdapter().updateSunProperties();
  }

  setMieCoefficient(_mieCoefficient: number) {
    this.updateSkyShaderValues();
    this.scene.getGraphicsAdapter().updateSunProperties();
  }

  setMieDirectionalG(_mieDirectionalG: number) {
    this.updateSkyShaderValues();
    this.scene.getGraphicsAdapter().updateSunProperties();
  }

  setPriority(priority: number) {
    this.priority = priority;
    this.scene.getGraphicsAdapter().updateSunPriority(this);
  }

  updateCharacterPosition(position: THREE.Vector3) {
    this.target.copy(position);
    this.updateSunPosition();
  }

  getSunGroup(): THREE.Group {
    return this.sunGroup;
  }

  getSky(): Sky | null {
    return this.sky;
  }

  getSkyCubeCamera(): THREE.CubeCamera | null {
    return this.skyCubeCamera;
  }

  getSkyRenderTarget(): THREE.WebGLCubeRenderTarget | null {
    return this.skyRenderTarget;
  }

  dispose() {
    if (this.sunGroup) {
      this.sunGroup.removeFromParent();
    }
    if (this.sky) {
      this.sky.removeFromParent();
    }
    if (this.skyRenderTarget) {
      this.skyRenderTarget.dispose();
    }
    if (this.cameraHelper) {
      this.cameraHelper.removeFromParent();
    }
    this.scene.getGraphicsAdapter().unregisterSun(this);
  }
}

export class MSun<G extends GameThreeJSAdapter> extends MElement<G> {
  static tagName = "m-sun";

  private sunGraphics: SunGraphics | null = null;

  public props: MSunProps = {
    intensity: defaultIntensity,
    priority: defaultPriority,
    color: defaultColor,
    azimuthalAngle: defaultAzimuthalAngle,
    polarAngle: defaultPolarAngle,
    resolution: defaultResolution,
    frustum: defaultFrustum,
    turbidity: defaultTurbidity,
    rayleigh: defaultRayleigh,
    mieCoefficient: defaultMieCoefficient,
    mieDirectionalG: defaultMieDirectionalG,
  };

  private sunAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    intensity: [
      AnimationType.Number,
      defaultIntensity,
      (newValue: number) => {
        this.props.intensity = newValue;
        this.sunGraphics?.setIntensity(newValue);
      },
    ],
    "azimuthal-angle": [
      AnimationType.Number,
      defaultAzimuthalAngle,
      (newValue: number) => {
        this.props.azimuthalAngle = newValue;
        this.sunGraphics?.setAzimuthalAngle(newValue);
      },
    ],
    "polar-angle": [
      AnimationType.Number,
      defaultPolarAngle,
      (newValue: number) => {
        this.props.polarAngle = newValue;
        this.sunGraphics?.setPolarAngle(newValue);
      },
    ],
    turbidity: [
      AnimationType.Number,
      defaultTurbidity,
      (newValue: number) => {
        this.props.turbidity = newValue;
        this.sunGraphics?.setTurbidity(newValue);
      },
    ],
    rayleigh: [
      AnimationType.Number,
      defaultRayleigh,
      (newValue: number) => {
        this.props.rayleigh = newValue;
        this.sunGraphics?.setRayleigh(newValue);
      },
    ],
    "mie-coefficient": [
      AnimationType.Number,
      defaultMieCoefficient,
      (newValue: number) => {
        this.props.mieCoefficient = newValue;
        this.sunGraphics?.setMieCoefficient(newValue);
      },
    ],
    "mie-directional-g": [
      AnimationType.Number,
      defaultMieDirectionalG,
      (newValue: number) => {
        this.props.mieDirectionalG = newValue;
        this.sunGraphics?.setMieDirectionalG(newValue);
      },
    ],
  });

  private static attributeHandler = new AttributeHandler<MSun<GameThreeJSAdapter>>({
    intensity: (instance, newValue) => {
      const intensityValue = newValue !== null ? parseFloat(newValue) : defaultIntensity;
      instance.sunAnimatedAttributeHelper.elementSetAttribute("intensity", intensityValue);
    },
    priority: (instance, newValue) => {
      let priorityValue = floatParser(newValue);
      if (priorityValue === null) {
        priorityValue = defaultPriority;
      }
      instance.props.priority = priorityValue;
      instance.sunGraphics?.setPriority(priorityValue);
    },
    color: (instance, newValue) => {
      const colorValue = newValue || defaultColor;
      instance.props.color = colorValue;
      instance.sunGraphics?.setColor(colorValue);
    },
    "azimuthal-angle": (instance, newValue) => {
      const angleValue = newValue !== null ? parseFloat(newValue) : defaultAzimuthalAngle;
      instance.sunAnimatedAttributeHelper.elementSetAttribute("azimuthal-angle", angleValue);
    },
    "polar-angle": (instance, newValue) => {
      const angleValue = newValue !== null ? parseFloat(newValue) : defaultPolarAngle;
      instance.sunAnimatedAttributeHelper.elementSetAttribute("polar-angle", angleValue);
    },
    resolution: (instance, newValue) => {
      const resolutionValue = newValue !== null ? parseInt(newValue) : defaultResolution;
      instance.props.resolution = resolutionValue;
      instance.sunGraphics?.setResolution(resolutionValue);
    },
    frustum: (instance, newValue) => {
      const frustumValue = newValue !== null ? parseFloat(newValue) : defaultFrustum;
      instance.props.frustum = frustumValue;
      instance.sunGraphics?.setFrustum(frustumValue);
    },
    turbidity: (instance, newValue) => {
      const turbidityValue = newValue !== null ? parseFloat(newValue) : defaultTurbidity;
      instance.sunAnimatedAttributeHelper.elementSetAttribute("turbidity", turbidityValue);
    },
    rayleigh: (instance, newValue) => {
      const rayleighValue = newValue !== null ? parseFloat(newValue) : defaultRayleigh;
      instance.sunAnimatedAttributeHelper.elementSetAttribute("rayleigh", rayleighValue);
    },
    "mie-coefficient": (instance, newValue) => {
      const mieCoeffValue = newValue !== null ? parseFloat(newValue) : defaultMieCoefficient;
      instance.sunAnimatedAttributeHelper.elementSetAttribute("mie-coefficient", mieCoeffValue);
    },
    "mie-directional-g": (instance, newValue) => {
      const mieDirGValue = newValue !== null ? parseFloat(newValue) : defaultMieDirectionalG;
      instance.sunAnimatedAttributeHelper.elementSetAttribute("mie-directional-g", mieDirGValue);
    },
  });

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  static get observedAttributes(): Array<string> {
    return [...MSun.attributeHandler.getAttributes()];
  }

  constructor() {
    super();
  }

  public getContentBounds(): null {
    return null;
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return false;
  }

  public getSunGraphics(): SunGraphics | null {
    return this.sunGraphics;
  }

  public addSideEffectChild(child: MElement<G>): void {
    this.sunAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.sunAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.sunGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    MSun.attributeHandler.handle(this, name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.sunGraphics) {
      return;
    }

    this.sunGraphics = new SunGraphics(this);

    for (const name of MSun.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }

  public disconnectedCallback(): void {
    this.sunAnimatedAttributeHelper.reset();
    this.sunGraphics?.dispose();
    this.sunGraphics = null;
    super.disconnectedCallback();
  }
}
