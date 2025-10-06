import {
  AnimatedAttributeHelper,
  AnimationType,
  AttributeHandler,
  floatParser,
  MElement,
  MMLScene,
} from "@mml-io/mml-web";
import * as THREE from "three";

import { GameThreeJSAdapter } from "../GameThreeJSAdapter";

const defaultIntensity = 1.0;
const defaultPriority = 1;
const defaultColor = "#ffffff";

export type MEnvironmentLightProps = {
  intensity: number;
  priority: number;
  color: string;
};

export class EnvironmentLightGraphics {
  scene: MMLScene<GameThreeJSAdapter>;
  threeScene: THREE.Scene;
  currentAmbientLight: THREE.AmbientLight | null = null;
  priority: number;

  constructor(public environmentLightElement: MEnvironmentLight<GameThreeJSAdapter>) {
    this.scene = environmentLightElement.getScene() as MMLScene<GameThreeJSAdapter>;
    this.threeScene = this.scene.getGraphicsAdapter().getThreeScene();
    this.priority = environmentLightElement.props.priority;

    this.scene.getGraphicsAdapter().registerEnvironmentLight(this);
    this.createAmbientLight();
  }

  createAmbientLight() {
    const { intensity, color } = this.environmentLightElement.props;
    const threeColor = new THREE.Color(color);
    this.currentAmbientLight = new THREE.AmbientLight(threeColor, intensity);
    this.applyEnvironmentLight();
  }

  setIntensity(intensity: number) {
    if (this.currentAmbientLight) {
      this.currentAmbientLight.intensity = intensity;
    }
    this.scene.getGraphicsAdapter().updateEnvironmentLightProperties();
  }

  setColor(color: string) {
    if (this.currentAmbientLight) {
      this.currentAmbientLight.color.set(color);
    }
    this.scene.getGraphicsAdapter().updateEnvironmentLightProperties();
  }

  setPriority(priority: number) {
    this.priority = priority;
    this.scene.getGraphicsAdapter().updateEnvironmentLightPriority(this);
  }

  private applyEnvironmentLight() {
    this.scene.getGraphicsAdapter().updateEnvironmentLightProperties();
  }

  private clearEnvironmentLight() {
    if (this.currentAmbientLight) {
      this.currentAmbientLight = null;
    }

    this.scene.getGraphicsAdapter().updateEnvironmentLightProperties();
  }

  dispose() {
    this.clearEnvironmentLight();
    this.scene.getGraphicsAdapter().unregisterEnvironmentLight(this);
  }
}

export class MEnvironmentLight<G extends GameThreeJSAdapter> extends MElement<G> {
  static tagName = "m-environment-light";

  private environmentLightGraphics: EnvironmentLightGraphics | null = null;

  public props: MEnvironmentLightProps = {
    intensity: defaultIntensity,
    priority: defaultPriority,
    color: defaultColor,
  };

  private environmentLightAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    intensity: [
      AnimationType.Number,
      defaultIntensity,
      (newValue: number) => {
        this.props.intensity = newValue;
        this.environmentLightGraphics?.setIntensity(newValue);
      },
    ],
  });

  private static attributeHandler = new AttributeHandler<MEnvironmentLight<GameThreeJSAdapter>>({
    intensity: (instance, newValue) => {
      const intensityValue = newValue !== null ? parseFloat(newValue) : defaultIntensity;
      instance.environmentLightAnimatedAttributeHelper.elementSetAttribute(
        "intensity",
        intensityValue,
      );
    },
    priority: (instance, newValue) => {
      let priorityValue = floatParser(newValue);
      if (priorityValue === null) {
        priorityValue = defaultPriority;
      }
      instance.props.priority = priorityValue;
      instance.environmentLightGraphics?.setPriority(priorityValue);
    },
    color: (instance, newValue) => {
      const colorValue = newValue || defaultColor;
      instance.props.color = colorValue;
      instance.environmentLightGraphics?.setColor(colorValue);
    },
  });

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  static get observedAttributes(): Array<string> {
    return [...MEnvironmentLight.attributeHandler.getAttributes()];
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

  public getEnvironmentLightGraphics(): EnvironmentLightGraphics | null {
    return this.environmentLightGraphics;
  }

  public addSideEffectChild(child: MElement<G>): void {
    this.environmentLightAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.environmentLightAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.environmentLightGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    MEnvironmentLight.attributeHandler.handle(this, name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.environmentLightGraphics) {
      return;
    }

    this.environmentLightGraphics = new EnvironmentLightGraphics(this);

    for (const name of MEnvironmentLight.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }

  public disconnectedCallback(): void {
    this.environmentLightAnimatedAttributeHelper.reset();
    this.environmentLightGraphics?.dispose();
    this.environmentLightGraphics = null;
    super.disconnectedCallback();
  }
}
