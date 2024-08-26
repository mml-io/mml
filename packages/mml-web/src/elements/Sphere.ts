import { AnimationType, AttributeAnimation } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { Vect3 } from "../math/Vect3";
import { MMLColor, SphereGraphics } from "../MMLGraphicsInterface";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

const defaultSphereColor: MMLColor = { r: 1, g: 1, b: 1 };
const defaultSphereRadius = 0.5;
const defaultSphereOpacity = 1;
const defaultSphereCastShadows = true;

export type MSphereProps = {
  radius: number;
  color: MMLColor;
  opacity: number;
  castShadows: boolean;
};

export class Sphere extends TransformableElement {
  static tagName = "m-sphere";

  public props: MSphereProps = {
    radius: defaultSphereRadius,
    color: defaultSphereColor,
    opacity: defaultSphereOpacity,
    castShadows: defaultSphereCastShadows,
  };

  private sphereAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    color: [
      AnimationType.Color,
      defaultSphereColor,
      (newValue: MMLColor) => {
        this.props.color = newValue;
        this.sphereGraphics?.setColor(newValue, this.props);
      },
    ],
    radius: [
      AnimationType.Number,
      defaultSphereRadius,
      (newValue: number) => {
        this.props.radius = newValue;
        this.sphereGraphics?.setRadius(newValue, this.props);
        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    opacity: [
      AnimationType.Number,
      defaultSphereOpacity,
      (newValue: number) => {
        this.props.opacity = newValue;
        this.sphereGraphics?.setOpacity(newValue, this.props);
      },
    ],
  });
  private collideableHelper = new CollideableHelper(this);

  private static attributeHandler = new AttributeHandler<Sphere>({
    radius: (instance, newValue) => {
      instance.sphereAnimatedAttributeHelper.elementSetAttribute(
        "radius",
        parseFloatAttribute(newValue, defaultSphereRadius),
      );
    },
    color: (instance, newValue) => {
      instance.sphereAnimatedAttributeHelper.elementSetAttribute(
        "color",
        parseColorAttribute(newValue, defaultSphereColor),
      );
    },
    opacity: (instance, newValue) => {
      instance.sphereAnimatedAttributeHelper.elementSetAttribute(
        "opacity",
        parseFloatAttribute(newValue, defaultSphereOpacity),
      );
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultSphereCastShadows);
      instance.sphereGraphics?.setCastShadows(instance.props.castShadows, instance.props);
    },
  });
  private sphereGraphics?: SphereGraphics;

  protected enable() {
    this.collideableHelper.enable();
  }

  protected disable() {
    this.collideableHelper.disable();
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromSizeAndMatrixWorldProvider(
      new Vect3(this.props.radius * 2, this.props.radius * 2, this.props.radius * 2),
      this.container,
    );
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Sphere.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  constructor() {
    super();
  }

  public addSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.sphereAnimatedAttributeHelper.addAnimation(child, attr);
      }
    }
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.sphereAnimatedAttributeHelper.removeAnimation(child, attr);
      }
    }
    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  public attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.isConnected) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    Sphere.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    this.sphereGraphics =
      new (this.getScene().getGraphicsAdapterFactory().MMLSphereGraphicsInterface)(this);

    for (const name of Sphere.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.applyBounds();
    this.collideableHelper.updateCollider(this.mesh);
  }

  public disconnectedCallback(): void {
    console.log("Sphere disconnected");
    this.collideableHelper.removeColliders();
    this.sphereGraphics?.dispose();
    this.sphereGraphics = undefined;
    super.disconnectedCallback();
  }
}
