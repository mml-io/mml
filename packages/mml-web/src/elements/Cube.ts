import { AnimationType, AttributeAnimation } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { Vect3 } from "../math/Vect3";
import { CubeGraphics, MMLColor } from "../MMLGraphicsInterface";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

const defaultCubeColor: MMLColor = { r: 1, g: 1, b: 1 };
const defaultCubeWidth = 1;
const defaultCubeHeight = 1;
const defaultCubeDepth = 1;
const defaultCubeOpacity = 1;
const defaultCubeCastShadows = true;

export type MCubeProps = {
  width: number;
  height: number;
  depth: number;
  color: MMLColor;
  opacity: number;
  castShadows: boolean;
};

export class Cube extends TransformableElement {
  static tagName = "m-cube";

  public props: MCubeProps = {
    width: defaultCubeWidth,
    height: defaultCubeHeight,
    depth: defaultCubeDepth,
    color: defaultCubeColor,
    opacity: defaultCubeOpacity,
    castShadows: defaultCubeCastShadows,
  };

  private cubeAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    color: [
      AnimationType.Color,
      defaultCubeColor,
      (newValue: MMLColor) => {
        this.props.color = newValue;
        this.cubeGraphics?.setColor(newValue, this.props);
      },
    ],
    width: [
      AnimationType.Number,
      defaultCubeWidth,
      (newValue: number) => {
        this.props.width = newValue;
        this.cubeGraphics?.setWidth(newValue, this.props);
        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    height: [
      AnimationType.Number,
      defaultCubeHeight,
      (newValue: number) => {
        this.props.height = newValue;
        this.cubeGraphics?.setHeight(newValue, this.props);
        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    depth: [
      AnimationType.Number,
      defaultCubeDepth,
      (newValue: number) => {
        this.props.depth = newValue;
        this.cubeGraphics?.setDepth(newValue, this.props);
        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    opacity: [
      AnimationType.Number,
      defaultCubeOpacity,
      (newValue: number) => {
        this.props.opacity = newValue;
        this.cubeGraphics?.setOpacity(newValue, this.props);
      },
    ],
  });
  private collideableHelper = new CollideableHelper(this);

  private static attributeHandler = new AttributeHandler<Cube>({
    width: (instance, newValue) => {
      instance.cubeAnimatedAttributeHelper.elementSetAttribute(
        "width",
        parseFloatAttribute(newValue, defaultCubeWidth),
      );
    },
    height: (instance, newValue) => {
      instance.cubeAnimatedAttributeHelper.elementSetAttribute(
        "height",
        parseFloatAttribute(newValue, defaultCubeHeight),
      );
    },
    depth: (instance, newValue) => {
      instance.cubeAnimatedAttributeHelper.elementSetAttribute(
        "depth",
        parseFloatAttribute(newValue, defaultCubeDepth),
      );
    },
    color: (instance, newValue) => {
      instance.cubeAnimatedAttributeHelper.elementSetAttribute(
        "color",
        parseColorAttribute(newValue, defaultCubeColor),
      );
    },
    opacity: (instance, newValue) => {
      instance.cubeAnimatedAttributeHelper.elementSetAttribute(
        "opacity",
        parseFloatAttribute(newValue, defaultCubeOpacity),
      );
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultCubeCastShadows);
      instance.cubeGraphics?.setCastShadows(instance.props.castShadows, instance.props);
    },
  });
  private cubeGraphics?: CubeGraphics;

  protected enable() {
    this.collideableHelper.enable();
  }

  protected disable() {
    this.collideableHelper.disable();
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromSizeAndMatrixWorldProvider(
      new Vect3(this.props.width, this.props.height, this.props.depth),
      this.container,
    );
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Cube.attributeHandler.getAttributes(),
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
        this.cubeAnimatedAttributeHelper.addAnimation(child, attr);
      }
    }
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.cubeAnimatedAttributeHelper.removeAnimation(child, attr);
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
    Cube.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    this.cubeGraphics = new (this.getScene().getGraphicsAdapterFactory().MMLCubeGraphicsInterface)(
      this,
    );

    for (const name of Cube.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.applyBounds();
    this.collideableHelper.updateCollider(this.mesh);
  }

  public disconnectedCallback(): void {
    console.log("Cube disconnected");
    this.collideableHelper.removeColliders();
    this.cubeGraphics?.dispose();
    this.cubeGraphics = undefined;
    super.disconnectedCallback();
  }
}
