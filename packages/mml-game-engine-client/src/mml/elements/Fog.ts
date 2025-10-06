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

const defaultNear = 10;
const defaultFar = 1000;
const defaultColor = "#ffffff";
const defaultPriority = 1;

export type MFogProps = {
  near: number;
  far: number;
  color: string;
  priority: number;
};

export class FogGraphics {
  scene: MMLScene<GameThreeJSAdapter>;
  threeScene: THREE.Scene;
  currentFog: THREE.Fog | null = null;
  priority: number;

  constructor(public fogElement: MFog<GameThreeJSAdapter>) {
    this.scene = fogElement.getScene() as MMLScene<GameThreeJSAdapter>;
    this.threeScene = this.scene.getGraphicsAdapter().getThreeScene();
    this.priority = fogElement.props.priority;

    this.scene.getGraphicsAdapter().registerFog(this);
    this.createFog();
  }

  createFog() {
    const { near, far, color } = this.fogElement.props;
    const threeColor = new THREE.Color(color);

    this.currentFog = new THREE.Fog(threeColor, near, far);
    this.applyFog();
  }

  setNear(near: number) {
    if (this.currentFog) {
      this.currentFog.near = near;
    }
    this.scene.getGraphicsAdapter().updateFogProperties();
  }

  setFar(far: number) {
    if (this.currentFog) {
      this.currentFog.far = far;
    }
    this.scene.getGraphicsAdapter().updateFogProperties();
  }

  setColor(color: string) {
    if (this.currentFog) {
      this.currentFog.color.set(color);
    }
    this.scene.getGraphicsAdapter().updateFogProperties();
  }

  setPriority(priority: number) {
    this.priority = priority;
    this.scene.getGraphicsAdapter().updateFogPriority(this);
  }

  private applyFog() {
    this.scene.getGraphicsAdapter().updateFogProperties();
  }

  private clearFog() {
    if (this.currentFog) {
      this.currentFog = null;
    }

    this.scene.getGraphicsAdapter().updateFogProperties();
  }

  dispose() {
    this.clearFog();
    this.scene.getGraphicsAdapter().unregisterFog(this);
  }
}

export class MFog<G extends GameThreeJSAdapter> extends MElement<G> {
  static tagName = "m-fog";

  private fogGraphics: FogGraphics | null = null;

  public props: MFogProps = {
    near: defaultNear,
    far: defaultFar,
    color: defaultColor,
    priority: defaultPriority,
  };

  private fogAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    near: [
      AnimationType.Number,
      defaultNear,
      (newValue: number) => {
        this.props.near = newValue;
        this.fogGraphics?.setNear(newValue);
      },
    ],
    far: [
      AnimationType.Number,
      defaultFar,
      (newValue: number) => {
        this.props.far = newValue;
        this.fogGraphics?.setFar(newValue);
      },
    ],
  });

  private static attributeHandler = new AttributeHandler<MFog<GameThreeJSAdapter>>({
    near: (instance, newValue) => {
      const nearValue = newValue !== null ? parseFloat(newValue) : defaultNear;
      instance.fogAnimatedAttributeHelper.elementSetAttribute("near", nearValue);
    },
    far: (instance, newValue) => {
      const farValue = newValue !== null ? parseFloat(newValue) : defaultFar;
      instance.fogAnimatedAttributeHelper.elementSetAttribute("far", farValue);
    },
    color: (instance, newValue) => {
      const colorValue = newValue || defaultColor;
      instance.props.color = colorValue;
      instance.fogGraphics?.setColor(colorValue);
    },
    priority: (instance, newValue) => {
      let priorityValue = floatParser(newValue);
      if (priorityValue === null) {
        priorityValue = defaultPriority;
      }
      instance.props.priority = priorityValue;
      instance.fogGraphics?.setPriority(priorityValue);
    },
  });

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  static get observedAttributes(): Array<string> {
    return [...MFog.attributeHandler.getAttributes()];
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

  public getFogGraphics(): FogGraphics | null {
    return this.fogGraphics;
  }

  public addSideEffectChild(child: MElement<G>): void {
    this.fogAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.fogAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.fogGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    MFog.attributeHandler.handle(this, name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.fogGraphics) {
      return;
    }

    this.fogGraphics = new FogGraphics(this);

    for (const name of MFog.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }

  public disconnectedCallback(): void {
    this.fogAnimatedAttributeHelper.reset();
    this.fogGraphics?.dispose();
    this.fogGraphics = null;
    super.disconnectedCallback();
  }
}
