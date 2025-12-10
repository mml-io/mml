import { AnimatedAttributeHelper } from "../attribute-animation";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { ClickableHelper } from "../clickable/ClickableHelper";
import { CollideableHelper } from "../collision";
import { MMLColor } from "../color";
import { GraphicsAdapter } from "../graphics";
import { CapsuleGraphics } from "../graphics/CapsuleGraphics";
import { Vect3 } from "../math/Vect3";
import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";

const defaultCapsuleColor: MMLColor = { r: 1, g: 1, b: 1 };
const defaultCapsuleRadius = 0.5;
const defaultCapsuleHeight = 1;
const defaultCapsuleOpacity = 1;
const defaultCapsuleCastShadows = true;

export type MCapsuleProps = {
  radius: number;
  height: number;
  color: MMLColor;
  opacity: number;
  castShadows: boolean;
};

export class Capsule<G extends GraphicsAdapter = GraphicsAdapter> extends TransformableElement<G> {
  static tagName = "m-capsule";
  private capsuleGraphics: CapsuleGraphics<G> | null;

  public props: MCapsuleProps = {
    radius: defaultCapsuleRadius,
    height: defaultCapsuleHeight,
    color: defaultCapsuleColor,
    opacity: defaultCapsuleOpacity,
    castShadows: defaultCapsuleCastShadows,
  };

  private capsuleAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    color: [
      AnimationType.Color,
      defaultCapsuleColor,
      (newValue: MMLColor) => {
        this.props.color = newValue;
        this.capsuleGraphics?.setColor(newValue, this.props);
      },
    ],
    radius: [
      AnimationType.Number,
      defaultCapsuleRadius,
      (newValue: number) => {
        this.props.radius = newValue;
        this.capsuleGraphics?.setRadius(newValue, this.props);
        this.applyBounds();
        this.collideableHelper.updateCollider(this.capsuleGraphics?.getCollisionElement());
      },
    ],
    height: [
      AnimationType.Number,
      defaultCapsuleHeight,
      (newValue: number) => {
        this.props.height = newValue;
        this.capsuleGraphics?.setHeight(newValue, this.props);
        this.applyBounds();
        this.collideableHelper.updateCollider(this.capsuleGraphics?.getCollisionElement());
      },
    ],
    opacity: [
      AnimationType.Number,
      defaultCapsuleOpacity,
      (newValue: number) => {
        this.props.opacity = newValue;
        this.capsuleGraphics?.setOpacity(newValue, this.props);
      },
    ],
  });
  private collideableHelper = new CollideableHelper(this);
  private clickableHelper = new ClickableHelper();

  private static attributeHandler = new AttributeHandler<Capsule<GraphicsAdapter>>({
    radius: (instance, newValue) => {
      instance.capsuleAnimatedAttributeHelper.elementSetAttribute(
        "radius",
        parseFloatAttribute(newValue, defaultCapsuleRadius),
      );
    },
    height: (instance, newValue) => {
      instance.capsuleAnimatedAttributeHelper.elementSetAttribute(
        "height",
        parseFloatAttribute(newValue, defaultCapsuleHeight),
      );
    },
    color: (instance, newValue) => {
      instance.capsuleAnimatedAttributeHelper.elementSetAttribute(
        "color",
        parseColorAttribute(newValue, defaultCapsuleColor),
      );
    },
    opacity: (instance, newValue) => {
      instance.capsuleAnimatedAttributeHelper.elementSetAttribute(
        "opacity",
        parseFloatAttribute(newValue, defaultCapsuleOpacity),
      );
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultCapsuleCastShadows);
      instance.capsuleGraphics?.setCastShadows(instance.props.castShadows, instance.props);
    },
  });

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
    // Total height is the middle section height plus the two hemisphere caps (radius * 2)
    const totalHeight = this.props.height + this.props.radius * 2;
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(this.props.radius * 2, totalHeight, this.props.radius * 2),
      this.transformableElementGraphics.getWorldMatrix(),
    );
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Capsule.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
      ...ClickableHelper.observedAttributes,
    ];
  }

  constructor() {
    super();
  }

  public addSideEffectChild(child: MElement<G>): void {
    this.capsuleAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.capsuleAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return this.clickableHelper.isClickable();
  }

  public attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.capsuleGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    Capsule.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
    this.clickableHelper.handle(name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.capsuleGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();

    this.capsuleGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLCapsuleGraphicsInterface(this);

    for (const name of Capsule.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.applyBounds();
    this.collideableHelper.updateCollider(this.capsuleGraphics?.getCollisionElement());
  }

  public disconnectedCallback(): void {
    this.collideableHelper.removeColliders();
    this.capsuleAnimatedAttributeHelper.reset();
    this.capsuleGraphics?.dispose();
    this.capsuleGraphics = null;
    super.disconnectedCallback();
  }
}
