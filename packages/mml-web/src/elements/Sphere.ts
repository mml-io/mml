import { MMLColor } from "../graphics/MMLColor";
import { SphereGraphics } from "../graphics/SphereGraphics";
import { GraphicsAdapter } from "../GraphicsAdapter";
import { Vect3 } from "../math/Vect3";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";
import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";

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

export class Sphere<G extends GraphicsAdapter = GraphicsAdapter> extends TransformableElement<G> {
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
        this.collideableHelper.updateCollider(this.sphereGraphics?.getCollisionElement());
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

  private static attributeHandler = new AttributeHandler<Sphere<GraphicsAdapter>>({
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
  private sphereGraphics: SphereGraphics<G> | null;

  protected enable() {
    this.collideableHelper.enable();
  }

  protected disable() {
    this.collideableHelper.disable();
  }

  public getContentBounds(): OrientedBoundingBox | null {
    if (!this.transformableElementGraphics) {
      return null;
    }
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(this.props.radius * 2, this.props.radius * 2, this.props.radius * 2),
      this.transformableElementGraphics.getWorldMatrix(),
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

  public addSideEffectChild(child: MElement<G>): void {
    this.sphereAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.sphereAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  public attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.sphereGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    Sphere.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    if (!graphicsAdapter || this.sphereGraphics) {
      return;
    }

    this.sphereGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLSphereGraphicsInterface(this);

    for (const name of Sphere.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.applyBounds();
    this.collideableHelper.updateCollider(this.sphereGraphics.getCollisionElement());
  }

  public disconnectedCallback(): void {
    this.collideableHelper.removeColliders();
    this.sphereAnimatedAttributeHelper.reset();
    this.sphereGraphics?.dispose();
    this.sphereGraphics = null;
    super.disconnectedCallback();
  }
}
