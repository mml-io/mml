import { AnimationType, AttributeAnimation } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { Vect3 } from "../math/Vect3";
import { CylinderGraphics, MMLColor } from "../MMLGraphicsInterface";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

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

export class Cylinder extends TransformableElement {
  static tagName = "m-cylinder";

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
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    height: [
      AnimationType.Number,
      defaultCylinderHeight,
      (newValue: number) => {
        this.props.height = newValue;
        this.cylinderGraphics?.setHeight(newValue, this.props);
        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
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

  private static attributeHandler = new AttributeHandler<Cylinder>({
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
  private cylinderGraphics?: CylinderGraphics;

  protected enable() {
    this.collideableHelper.enable();
  }

  protected disable() {
    this.collideableHelper.disable();
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromSizeAndMatrixWorldProvider(
      new Vect3(this.props.radius * 2, this.props.height, this.props.radius * 2),
      this.container,
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

  public addSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.cylinderAnimatedAttributeHelper.addAnimation(child, attr);
      }
    }
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.cylinderAnimatedAttributeHelper.removeAnimation(child, attr);
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
    Cylinder.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    this.cylinderGraphics =
      new (this.getScene().getGraphicsAdapterFactory().MMLCylinderGraphicsInterface)(this);

    for (const name of Cylinder.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.applyBounds();
    this.collideableHelper.updateCollider(this.mesh);
  }

  public disconnectedCallback(): void {
    console.log("Cylinder disconnected");
    this.collideableHelper.removeColliders();
    this.cylinderGraphics?.dispose();
    this.cylinderGraphics = undefined;
    super.disconnectedCallback();
  }
}
