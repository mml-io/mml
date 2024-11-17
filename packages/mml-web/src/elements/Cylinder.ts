import { AnimatedAttributeHelper } from "../attribute-animation";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { CollideableHelper } from "../collision";
import { MMLColor } from "../color";
import { GraphicsAdapter } from "../graphics";
import { CylinderGraphics } from "../graphics/CylinderGraphics";
import { Vect3 } from "../math/Vect3";
import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";

const defaultCylinderColor: MMLColor = { r: 1, g: 1, b: 1 };
const defaultCylinderRadius = 0.5;
const defaultCylinderHeight = 1;
const defaultCylinderOpacity = 1;
const defaultCylinderCastShadows = true;

export type MCylinderProps = {
  radius: number;
  height: number;
  color: MMLColor;
  opacity: number;
  castShadows: boolean;
};

export class Cylinder<G extends GraphicsAdapter = GraphicsAdapter> extends TransformableElement<G> {
  static tagName = "m-cylinder";
  private cylinderGraphics: CylinderGraphics<G> | null;

  public props: MCylinderProps = {
    radius: defaultCylinderRadius,
    height: defaultCylinderHeight,
    color: defaultCylinderColor,
    opacity: defaultCylinderOpacity,
    castShadows: defaultCylinderCastShadows,
  };

  private cylinderAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    color: [
      AnimationType.Color,
      defaultCylinderColor,
      (newValue: MMLColor) => {
        this.props.color = newValue;
        this.cylinderGraphics?.setColor(newValue, this.props);
      },
    ],
    radius: [
      AnimationType.Number,
      defaultCylinderRadius,
      (newValue: number) => {
        this.props.radius = newValue;
        this.cylinderGraphics?.setRadius(newValue, this.props);
        this.applyBounds();
        this.collideableHelper.updateCollider(this.cylinderGraphics?.getCollisionElement());
      },
    ],
    height: [
      AnimationType.Number,
      defaultCylinderHeight,
      (newValue: number) => {
        this.props.height = newValue;
        this.cylinderGraphics?.setHeight(newValue, this.props);
        this.applyBounds();
        this.collideableHelper.updateCollider(this.cylinderGraphics?.getCollisionElement());
      },
    ],
    opacity: [
      AnimationType.Number,
      defaultCylinderOpacity,
      (newValue: number) => {
        this.props.opacity = newValue;
        this.cylinderGraphics?.setOpacity(newValue, this.props);
      },
    ],
  });
  private collideableHelper = new CollideableHelper(this);

  private static attributeHandler = new AttributeHandler<Cylinder<GraphicsAdapter>>({
    radius: (instance, newValue) => {
      instance.cylinderAnimatedAttributeHelper.elementSetAttribute(
        "radius",
        parseFloatAttribute(newValue, defaultCylinderRadius),
      );
    },
    height: (instance, newValue) => {
      instance.cylinderAnimatedAttributeHelper.elementSetAttribute(
        "height",
        parseFloatAttribute(newValue, defaultCylinderHeight),
      );
    },
    color: (instance, newValue) => {
      instance.cylinderAnimatedAttributeHelper.elementSetAttribute(
        "color",
        parseColorAttribute(newValue, defaultCylinderColor),
      );
    },
    opacity: (instance, newValue) => {
      instance.cylinderAnimatedAttributeHelper.elementSetAttribute(
        "opacity",
        parseFloatAttribute(newValue, defaultCylinderOpacity),
      );
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultCylinderCastShadows);
      instance.cylinderGraphics?.setCastShadows(instance.props.castShadows, instance.props);
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
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(this.props.radius * 2, this.props.height, this.props.radius * 2),
      this.transformableElementGraphics.getWorldMatrix(),
    );
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Cylinder.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  constructor() {
    super();
  }

  public addSideEffectChild(child: MElement<G>): void {
    this.cylinderAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.cylinderAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  public attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.cylinderGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    Cylinder.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    if (!graphicsAdapter || this.cylinderGraphics) {
      return;
    }

    this.cylinderGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLCylinderGraphicsInterface(this);

    for (const name of Cylinder.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.applyBounds();
    this.collideableHelper.updateCollider(this.cylinderGraphics?.getCollisionElement());
  }

  public disconnectedCallback(): void {
    this.collideableHelper.removeColliders();
    this.cylinderAnimatedAttributeHelper.reset();
    this.cylinderGraphics?.dispose();
    this.cylinderGraphics = null;
    super.disconnectedCallback();
  }
}
