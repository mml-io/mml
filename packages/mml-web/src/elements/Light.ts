import { AnimatedAttributeHelper } from "../attribute-animation";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseEnumAttribute,
  parseFloatAttribute,
} from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { MMLColor } from "../color";
import { GraphicsAdapter, LightGraphics } from "../graphics";
import { AnimationType, AttributeAnimation } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";

export enum LightTypes {
  spotlight = "spotlight",
  point = "point",
}

const defaultLightColor: MMLColor = { r: 1, g: 1, b: 1 };
const defaultLightIntensity = 1;
const defaultLightAngle = 45;
const defaultLightEnabled = true;
const defaultLightDebug = false;
const defaultLightDistance = null;
const defaultLightCastShadows = true;
const defaultLightType = LightTypes.spotlight;

export type MLightProps = {
  color: MMLColor;
  intensity: number;
  enabled: boolean;
  angleDeg: number;
  distance: number | null;
  castShadows: boolean;
  debug: boolean;
  type: LightTypes;
};

export class Light<G extends GraphicsAdapter = GraphicsAdapter> extends TransformableElement<G> {
  static tagName = "m-light";

  private lightGraphics: LightGraphics<G> | null;

  private lightAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    color: [
      AnimationType.Color,
      defaultLightColor,
      (newValue: MMLColor) => {
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

  public props: MLightProps = {
    color: defaultLightColor,
    intensity: defaultLightIntensity,
    enabled: defaultLightEnabled,
    angleDeg: defaultLightAngle,
    distance: defaultLightDistance,
    castShadows: defaultLightCastShadows,
    debug: defaultLightDebug,
    type: defaultLightType as LightTypes,
  };

  private static attributeHandler = new AttributeHandler<Light<GraphicsAdapter>>({
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
      instance.lightAnimatedAttributeHelper.elementSetAttribute(
        "angle",
        parseFloatAttribute(newValue, defaultLightAngle),
      );
    },
    distance: (instance, newValue) => {
      instance.lightAnimatedAttributeHelper.elementSetAttribute(
        "distance",
        parseFloatAttribute(newValue, defaultLightDistance),
      );
    },
    enabled: (instance, newValue) => {
      instance.props.enabled = parseBoolAttribute(newValue, defaultLightEnabled);
      instance.lightGraphics?.setEnabled(instance.props.enabled, instance.props);
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultLightCastShadows);
      instance.lightGraphics?.setCastShadows(instance.props.castShadows, instance.props);
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

  constructor() {
    super();
  }

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  public getContentBounds(): OrientedBoundingBox | null {
    if (!this.transformableElementGraphics) {
      return null;
    }
    return OrientedBoundingBox.fromMatrixWorld(this.transformableElementGraphics.getWorldMatrix());
  }

  public addSideEffectChild(child: MElement<G>): void {
    if (AttributeAnimation.isAttributeAnimation(child)) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.lightAnimatedAttributeHelper.addAnimation(child, attr);
      }
    }
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    if (AttributeAnimation.isAttributeAnimation(child)) {
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
    if (!this.lightGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    Light.attributeHandler.handle(this, name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.lightGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();

    this.lightGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLLightGraphicsInterface(this);

    for (const name of Light.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }

  public disconnectedCallback() {
    this.lightAnimatedAttributeHelper.reset();
    this.lightGraphics?.dispose();
    this.lightGraphics = null;
    super.disconnectedCallback();
  }
}
