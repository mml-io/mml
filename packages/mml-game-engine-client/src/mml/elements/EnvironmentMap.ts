import {
  AnimatedAttributeHelper,
  AnimationType,
  AttributeHandler,
  floatParser,
  MElement,
  MMLScene,
} from "@mml-io/mml-web";
import * as THREE from "three";
import { PMREMGenerator } from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

import { GameThreeJSAdapter } from "../GameThreeJSAdapter";

const defaultIntensity = 1.0;
const defaultAzimuthalAngle = 0.0;
const defaultPriority = 1;

export type MEnvironmentMapProps = {
  intensity: number;
  azimuthalAngle: number;
  priority: number;
  src?: string;
};

export class EnvironmentMapGraphics {
  scene: MMLScene<GameThreeJSAdapter>;
  threeScene: THREE.Scene;
  currentEnvironmentMap: THREE.Texture | null = null;
  originalEnvironmentIntensity: number = 1;
  priority: number;

  constructor(public environmentMapElement: MEnvironmentMap<GameThreeJSAdapter>) {
    this.scene = environmentMapElement.getScene() as MMLScene<GameThreeJSAdapter>;
    this.threeScene = this.scene.getGraphicsAdapter().getThreeScene();

    this.originalEnvironmentIntensity = this.threeScene.environmentIntensity || 1;
    this.priority = environmentMapElement.props.priority;

    this.scene.getGraphicsAdapter().registerEnvironmentMap(this);
  }

  async loadHDR(src: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const renderer = this.scene.getGraphicsAdapter().getRenderer();
      const pmremGenerator = new PMREMGenerator(renderer);
      const loader = new RGBELoader();

      loader.load(
        src,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          const envMap = pmremGenerator.fromEquirectangular(texture).texture;
          texture.dispose();
          pmremGenerator.dispose();

          if (envMap) {
            envMap.colorSpace = THREE.LinearSRGBColorSpace;
            envMap.needsUpdate = true;
            resolve(envMap);
          } else {
            reject("Failed to generate environment map");
          }
        },
        undefined,
        (error) => {
          reject(error);
        },
      );
    });
  }

  async setSrc(src: string | undefined) {
    if (!src) {
      this.clearEnvironmentMap();
      return;
    }

    try {
      const contentSrc = this.environmentMapElement.contentSrcToContentAddress(src);
      const hdrTexture = await this.loadHDR(contentSrc);
      this.currentEnvironmentMap = hdrTexture;
      this.applyEnvironmentMap();
    } catch (error) {
      console.error("Failed to load HDR environment map:", error);
    }
  }

  setIntensity(_intensity: number) {
    this.scene.getGraphicsAdapter().updateEnvironmentMapProperties();
  }

  setAzimuthalAngle(_angle: number) {
    this.scene.getGraphicsAdapter().updateEnvironmentMapProperties();
  }

  setPriority(priority: number) {
    this.priority = priority;
    this.scene.getGraphicsAdapter().updateEnvironmentMapPriority(this);
  }

  private applyEnvironmentMap() {
    this.scene.getGraphicsAdapter().updateEnvironmentMapProperties();
  }

  private clearEnvironmentMap() {
    if (this.currentEnvironmentMap) {
      this.currentEnvironmentMap.dispose();
      this.currentEnvironmentMap = null;
    }

    this.scene.getGraphicsAdapter().updateEnvironmentMapProperties();
  }

  dispose() {
    this.clearEnvironmentMap();
    this.scene.getGraphicsAdapter().unregisterEnvironmentMap(this);
  }
}

export class MEnvironmentMap<G extends GameThreeJSAdapter> extends MElement<G> {
  static tagName = "m-environment-map";

  private environmentMapGraphics: EnvironmentMapGraphics | null = null;

  public props: MEnvironmentMapProps = {
    intensity: defaultIntensity,
    azimuthalAngle: defaultAzimuthalAngle,
    priority: defaultPriority,
    src: undefined,
  };

  private environmentMapAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    intensity: [
      AnimationType.Number,
      defaultIntensity,
      (newValue: number) => {
        this.props.intensity = newValue;
        this.environmentMapGraphics?.setIntensity(newValue);
      },
    ],
    "azimuthal-angle": [
      AnimationType.Number,
      defaultAzimuthalAngle,
      (newValue: number) => {
        this.props.azimuthalAngle = newValue;
        this.environmentMapGraphics?.setAzimuthalAngle(newValue);
      },
    ],
  });

  private static attributeHandler = new AttributeHandler<MEnvironmentMap<GameThreeJSAdapter>>({
    intensity: (instance, newValue) => {
      const intensityValue = newValue !== null ? parseFloat(newValue) : defaultIntensity;
      instance.environmentMapAnimatedAttributeHelper.elementSetAttribute(
        "intensity",
        intensityValue,
      );
    },
    "azimuthal-angle": (instance, newValue) => {
      const angleValue = newValue !== null ? parseFloat(newValue) : defaultAzimuthalAngle;
      instance.environmentMapAnimatedAttributeHelper.elementSetAttribute(
        "azimuthal-angle",
        angleValue,
      );
    },
    priority: (instance, newValue) => {
      let priorityValue = floatParser(newValue);
      if (priorityValue === null) {
        priorityValue = defaultPriority;
      }
      instance.props.priority = priorityValue;
      instance.environmentMapGraphics?.setPriority(priorityValue);
    },
    src: (instance, newValue) => {
      instance.props.src = newValue || undefined;
      if (instance.environmentMapGraphics) {
        instance.environmentMapGraphics.setSrc(instance.props.src);
      }
    },
  });

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  static get observedAttributes(): Array<string> {
    return [...MEnvironmentMap.attributeHandler.getAttributes()];
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

  public getEnvironmentMapGraphics(): EnvironmentMapGraphics | null {
    return this.environmentMapGraphics;
  }

  public addSideEffectChild(child: MElement<G>): void {
    this.environmentMapAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.environmentMapAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.environmentMapGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    MEnvironmentMap.attributeHandler.handle(this, name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.environmentMapGraphics) {
      return;
    }

    this.environmentMapGraphics = new EnvironmentMapGraphics(this);

    for (const name of MEnvironmentMap.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }

  public disconnectedCallback(): void {
    this.environmentMapAnimatedAttributeHelper.reset();
    this.environmentMapGraphics?.dispose();
    this.environmentMapGraphics = null;
    super.disconnectedCallback();
  }
}
