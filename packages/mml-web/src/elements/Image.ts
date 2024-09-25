import { ImageGraphics } from "../graphics/ImageGraphics";
import { GraphicsAdapter } from "../GraphicsAdapter";
import { Vect3 } from "../math/Vect3";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";
import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";

const defaultImageSrc = null;
const defaultImageWidth = null;
const defaultImageHeight = null;
const defaultImageOpacity = 1;
const defaultImageCastShadows = true;
const defaultImageEmissive = 0;

export type MImageProps = {
  src: string | null;
  width: number | null;
  height: number | null;
  opacity: number;
  castShadows: boolean;
  emissive: number;
};

export class Image<G extends GraphicsAdapter = GraphicsAdapter> extends TransformableElement<G> {
  static tagName = "m-image";

  public props: MImageProps = {
    src: defaultImageSrc,
    width: defaultImageWidth,
    height: defaultImageHeight,
    opacity: defaultImageOpacity,
    castShadows: defaultImageCastShadows,
    emissive: defaultImageEmissive as number,
  };

  private imageAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    width: [
      AnimationType.Number,
      defaultImageWidth,
      (newValue: number) => {
        this.props.width = newValue;
        this.imageGraphics?.setWidth(newValue, this.props);
      },
    ],
    height: [
      AnimationType.Number,
      defaultImageHeight,
      (newValue: number) => {
        this.props.height = newValue;
        this.imageGraphics?.setHeight(newValue, this.props);
      },
    ],
    opacity: [
      AnimationType.Number,
      defaultImageOpacity,
      (newValue: number) => {
        this.props.opacity = newValue;
        this.imageGraphics?.setOpacity(newValue, this.props);
      },
    ],
    emissive: [
      AnimationType.Number,
      defaultImageEmissive,
      (newValue: number) => {
        this.props.emissive = newValue;
        this.imageGraphics?.setEmissive(newValue, this.props);
      },
    ],
  });

  private collideableHelper = new CollideableHelper(this);

  private static attributeHandler = new AttributeHandler<Image<GraphicsAdapter>>({
    width: (instance, newValue) => {
      instance.imageAnimatedAttributeHelper.elementSetAttribute(
        "width",
        parseFloatAttribute(newValue, defaultImageWidth),
      );
    },
    height: (instance, newValue) => {
      instance.imageAnimatedAttributeHelper.elementSetAttribute(
        "height",
        parseFloatAttribute(newValue, defaultImageHeight),
      );
    },
    src: (instance, newValue) => {
      instance.props.src = newValue;
      instance.imageGraphics?.setSrc(newValue, instance.props);
    },
    opacity: (instance, newValue) => {
      instance.imageAnimatedAttributeHelper.elementSetAttribute(
        "opacity",
        parseFloatAttribute(newValue, defaultImageOpacity),
      );
    },
    emissive: (instance, newValue) => {
      instance.imageAnimatedAttributeHelper.elementSetAttribute(
        "emissive",
        parseFloatAttribute(newValue, defaultImageEmissive),
      );
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultImageCastShadows);
      instance.imageGraphics?.setCastShadows(instance.props.castShadows, instance.props);
    },
  });
  private imageGraphics: ImageGraphics<G> | null;

  protected enable() {
    this.collideableHelper.enable();
  }

  protected disable() {
    this.collideableHelper.disable();
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Image.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  constructor() {
    super();
  }

  public getContentBounds(): OrientedBoundingBox | null {
    if (!this.transformableElementGraphics) {
      return null;
    }
    const { width, height } = this.imageGraphics?.getWidthAndHeight() || { width: 0, height: 0 };
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(width, height, 0),
      this.transformableElementGraphics.getWorldMatrix(),
    );
  }

  public addSideEffectChild(child: MElement<G>): void {
    this.imageAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.imageAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.imageGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    Image.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  connectedCallback(): void {
    super.connectedCallback();

    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    if (!graphicsAdapter || this.imageGraphics) {
      return;
    }

    this.imageGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLImageGraphicsInterface(this, () => {
        this.applyBounds();
        this.collideableHelper.updateCollider(this.imageGraphics?.getCollisionElement());
      });

    for (const name of Image.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.collideableHelper.updateCollider(this.imageGraphics?.getCollisionElement());
  }

  disconnectedCallback() {
    this.imageAnimatedAttributeHelper.reset();
    this.imageGraphics?.dispose();
    this.imageGraphics = null;
    super.disconnectedCallback();
    this.collideableHelper.removeColliders();
  }
}
