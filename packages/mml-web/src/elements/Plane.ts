import { AnimationType, AttributeAnimation } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { Vect3 } from "../math/Vect3";
import { MMLColor, PlaneGraphics } from "../MMLGraphicsInterface";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

const defaultPlaneColor: MMLColor = { r: 1, g: 1, b: 1 };
const defaultPlaneWidth = 1;
const defaultPlaneHeight = 1;
const defaultPlaneOpacity = 1;
const defaultPlaneCastShadows = true;

export type MPlaneProps = {
  width: number;
  height: number;
  color: MMLColor;
  opacity: number;
  castShadows: boolean;
};

export class Plane extends TransformableElement {
  static tagName = "m-plane";

  public props: MPlaneProps = {
    width: defaultPlaneWidth,
    height: defaultPlaneHeight,
    color: defaultPlaneColor,
    opacity: defaultPlaneOpacity,
    castShadows: defaultPlaneCastShadows,
  };

  private planeAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    color: [
      AnimationType.Color,
      defaultPlaneColor,
      (newValue: MMLColor) => {
        this.props.color = newValue;
        this.planeGraphics?.setColor(newValue, this.props);
      },
    ],
    width: [
      AnimationType.Number,
      defaultPlaneWidth,
      (newValue: number) => {
        this.props.width = newValue;
        this.planeGraphics?.setWidth(newValue, this.props);
        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    height: [
      AnimationType.Number,
      defaultPlaneHeight,
      (newValue: number) => {
        this.props.height = newValue;
        this.planeGraphics?.setHeight(newValue, this.props);
        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    opacity: [
      AnimationType.Number,
      defaultPlaneOpacity,
      (newValue: number) => {
        this.props.opacity = newValue;
        this.planeGraphics?.setOpacity(newValue, this.props);
      },
    ],
  });
  private collideableHelper = new CollideableHelper(this);

  private static attributeHandler = new AttributeHandler<Plane>({
    width: (instance, newValue) => {
      instance.planeAnimatedAttributeHelper.elementSetAttribute(
        "width",
        parseFloatAttribute(newValue, defaultPlaneWidth),
      );
    },
    height: (instance, newValue) => {
      instance.planeAnimatedAttributeHelper.elementSetAttribute(
        "height",
        parseFloatAttribute(newValue, defaultPlaneHeight),
      );
    },
    color: (instance, newValue) => {
      instance.planeAnimatedAttributeHelper.elementSetAttribute(
        "color",
        parseColorAttribute(newValue, defaultPlaneColor),
      );
    },
    opacity: (instance, newValue) => {
      instance.planeAnimatedAttributeHelper.elementSetAttribute(
        "opacity",
        parseFloatAttribute(newValue, defaultPlaneOpacity),
      );
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultPlaneCastShadows);
      instance.planeGraphics?.setCastShadows(instance.props.castShadows, instance.props);
    },
  });
  private planeGraphics?: PlaneGraphics;

  protected enable() {
    this.collideableHelper.enable();
  }

  protected disable() {
    this.collideableHelper.disable();
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromSizeAndMatrixWorldProvider(
      new Vect3(this.props.width, this.props.height, 0),
      this.container,
    );
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Plane.attributeHandler.getAttributes(),
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
        this.planeAnimatedAttributeHelper.addAnimation(child, attr);
      }
    }
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.planeAnimatedAttributeHelper.removeAnimation(child, attr);
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
    Plane.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    this.planeGraphics =
      new (this.getScene().getGraphicsAdapterFactory().MMLPlaneGraphicsInterface)(this);

    for (const name of Plane.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.applyBounds();
    this.collideableHelper.updateCollider(this.mesh);
  }

  public disconnectedCallback(): void {
    console.log("Plane disconnected");
    this.collideableHelper.removeColliders();
    this.planeGraphics?.dispose();
    this.planeGraphics = undefined;
    super.disconnectedCallback();
  }
}
