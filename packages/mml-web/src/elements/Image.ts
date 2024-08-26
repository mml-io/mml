import { AnimationType, AttributeAnimation } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { ImageGraphics } from "../MMLGraphicsInterface";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

const defaultImageSrc = null;
const defaultImageWidth = null;
const defaultImageHeight = null;
const defaultImageOpacity = 1;
const defaultImageCastShadows = true;

export type MImageProps = {
  src: string | null;
  width: number | null;
  height: number | null;
  opacity: number;
  castShadows: boolean;
};

export class Image extends TransformableElement {
  static tagName = "m-image";

  public props: MImageProps = {
    src: defaultImageSrc,
    width: defaultImageWidth as number | null,
    height: defaultImageHeight as number | null,
    opacity: defaultImageOpacity,
    castShadows: defaultImageCastShadows,
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
  });

  private collideableHelper = new CollideableHelper(this);

  private static attributeHandler = new AttributeHandler<Image>({
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
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultImageCastShadows);
      instance.imageGraphics?.setCastShadows(instance.props.castShadows, instance.props);
    },
  });
  private imageGraphics: ImageGraphics;

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

  protected getContentBounds(): OrientedBoundingBox | null {
    // TODO
    // return OrientedBoundingBox.fromSizeAndMatrixWorldProvider(
    //   new Vect3(this.mesh.scale.x, this.mesh.scale.y, 0),
    //   this.container,
    // );
    return null;
  }

  public addSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.imageAnimatedAttributeHelper.addAnimation(child, attr);
      }
    }
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.imageAnimatedAttributeHelper.removeAnimation(child, attr);
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

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.isConnected) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    Image.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.imageGraphics =
      new (this.getScene().getGraphicsAdapterFactory().MMLImageGraphicsInterface)(this);

    for (const name of Image.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }

  disconnectedCallback() {
    this.imageGraphics?.dispose();
    super.disconnectedCallback();
    this.collideableHelper.removeColliders();
  }

  // TODO
  // public getImageMesh(): THREE.Mesh<
  //   THREE.PlaneGeometry,
  //   THREE.Material | Array<THREE.Material>
  // > | null {
  //   return this.mesh;
  // }
}
