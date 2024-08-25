import * as playcanvas from "playcanvas";

import { AnimationType, AttributeAnimation } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { LightGraphics, MMLColor } from "../MMLGraphicsInterface";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseEnumAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

export enum LightTypes {
  spotlight = "spotlight",
  point = "point",
}

const defaultLightColor: MMLColor = { r: 1, g: 1, b: 1 };
const defaultLightIntensity = 1;
const defaultLightAngle = 45;
const defaultLightEnabled = true;
const defaultLightDebug = false;
const defaultLightDistance = 0;
const defaultLightCastShadow = true;
const defaultLightType = LightTypes.spotlight;

export type LightProps = {
  color: MMLColor;
  intensity: number;
  enabled: boolean;
  angleDeg: number;
  distance: number;
  castShadow: boolean;
  debug: boolean;
  type: LightTypes;
};

export class Light extends TransformableElement {
  static tagName = "m-light";

  private lightGraphics?: LightGraphics;

  private lightAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    color: [
      AnimationType.Color,
      defaultLightColor,
      (newValue: playcanvas.Color) => {
        this.props.color = newValue;
        this.lightGraphics?.setColor(newValue, this.props);
      },
    ],
    intensity: [
      AnimationType.Number,
      defaultLightIntensity,
      (newValue: number) => {
        this.props.intensity = newValue;
        this.lightGraphics?.setIntensity(newValue, this.props);
      },
    ],
    angle: [
      AnimationType.Number,
      defaultLightAngle,
      (newValue: number) => {
        this.props.angleDeg = newValue;
        this.lightGraphics?.setAngle(newValue, this.props);
      },
    ],
    distance: [
      AnimationType.Number,
      defaultLightDistance,
      (newValue: number) => {
        this.props.distance = newValue;
        this.lightGraphics?.setDistance(newValue, this.props);
      },
    ],
  });

  public props = {
    color: defaultLightColor,
    intensity: defaultLightIntensity,
    enabled: defaultLightEnabled,
    angleDeg: defaultLightAngle,
    distance: defaultLightDistance,
    castShadow: defaultLightCastShadow,
    debug: defaultLightDebug,
    type: defaultLightType as LightTypes,
  };

  private static attributeHandler = new AttributeHandler<Light>({
    color: (instance, newValue) => {
      instance.lightAnimatedAttributeHelper.elementSetAttribute(
        "color",
        parseColorAttribute(newValue, defaultLightColor),
      );
    },
    intensity: (instance, newValue) => {
      instance.lightAnimatedAttributeHelper.elementSetAttribute(
        "intensity",
        parseFloatAttribute(newValue, defaultLightIntensity),
      );
    },
    angle: (instance, newValue) => {
      instance.props.angleDeg = parseFloatAttribute(newValue, defaultLightAngle);
      instance.lightGraphics?.setAngle(instance.props.angleDeg, instance.props);
    },
    distance: (instance, newValue) => {
      instance.props.distance = parseFloatAttribute(newValue, defaultLightDistance);
      instance.lightGraphics?.setDistance(instance.props.distance, instance.props);
    },
    enabled: (instance, newValue) => {
      instance.props.enabled = parseBoolAttribute(newValue, defaultLightEnabled);
      instance.lightGraphics?.setEnabled(instance.props.enabled, instance.props);
    },
    "cast-shadow": (instance, newValue) => {
      instance.props.castShadow = parseBoolAttribute(newValue, defaultLightCastShadow);
      instance.lightGraphics?.setCastShadow(instance.props.castShadow, instance.props);
    },
    debug: (instance, newValue) => {
      instance.props.debug = parseBoolAttribute(newValue, defaultLightDebug);
      instance.lightGraphics?.setDebug(instance.props.debug, instance.props);
    },
    type: (instance, newValue) => {
      instance.props.type = parseEnumAttribute(newValue, LightTypes, defaultLightType);
      instance.lightGraphics?.setType(instance.props.type, instance.props);
    },
  });

  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes, ...Light.attributeHandler.getAttributes()];
  }

  private light: playcanvas.Entity;
  private lightComponent: playcanvas.LightComponent;

  constructor() {
    super();
  }

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromMatrixWorldProvider(this.container);
  }

  public addSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.lightAnimatedAttributeHelper.addAnimation(child, attr);
      }
    }
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.lightAnimatedAttributeHelper.removeAnimation(child, attr);
      }
    }
    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return false;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.isConnected) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    Light.attributeHandler.handle(this, name, newValue);
  }

  public connectedCallback() {
    super.connectedCallback();

    this.lightGraphics =
      new (this.getScene().getGraphicsAdapterFactory().MMLLightGraphicsInterface)(this);

    for (const name of Light.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }

  public disconnectedCallback() {
    this.lightGraphics?.dispose();
    this.lightGraphics = undefined;
    super.disconnectedCallback();
  }
}
