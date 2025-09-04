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
import { CubeGraphics } from "../graphics/CubeGraphics";
import { Vect3 } from "../math/Vect3";
import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";

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

export class Cube<G extends GraphicsAdapter = GraphicsAdapter> extends TransformableElement<G> {
  static tagName = "m-cube";
  private cubeGraphics: CubeGraphics<G> | null = null;

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
        this.collideableHelper.updateCollider(this.cubeGraphics?.getCollisionElement());
      },
    ],
    height: [
      AnimationType.Number,
      defaultCubeHeight,
      (newValue: number) => {
        this.props.height = newValue;
        this.cubeGraphics?.setHeight(newValue, this.props);
        this.applyBounds();
        this.collideableHelper.updateCollider(this.cubeGraphics?.getCollisionElement());
      },
    ],
    depth: [
      AnimationType.Number,
      defaultCubeDepth,
      (newValue: number) => {
        this.props.depth = newValue;
        this.cubeGraphics?.setDepth(newValue, this.props);
        this.applyBounds();
        this.collideableHelper.updateCollider(this.cubeGraphics?.getCollisionElement());
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
  private clickableHelper = new ClickableHelper();

  private static attributeHandler = new AttributeHandler<Cube<GraphicsAdapter>>({
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
      new Vect3(this.props.width, this.props.height, this.props.depth),
      this.transformableElementGraphics.getWorldMatrix(),
    );
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Cube.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
      ...ClickableHelper.observedAttributes,
    ];
  }

  constructor() {
    super();
  }

  public addSideEffectChild(child: MElement<G>): void {
    this.cubeAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.cubeAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return this.clickableHelper.isClickable();
  }

  public attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.cubeGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    Cube.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
    this.clickableHelper.handle(name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.cubeGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();

    this.cubeGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLCubeGraphicsInterface(this);

    for (const name of Cube.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.applyBounds();
    this.collideableHelper.updateCollider(this.cubeGraphics?.getCollisionElement());
  }

  public disconnectedCallback(): void {
    this.collideableHelper.removeColliders();
    this.cubeAnimatedAttributeHelper.reset();
    this.cubeGraphics?.dispose();
    this.cubeGraphics = null;
    super.disconnectedCallback();
  }
}
