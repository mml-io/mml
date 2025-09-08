import { AnimatedAttributeHelper } from "../attribute-animation";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseEnumAttribute,
  parseFloatAttribute,
} from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { CollideableHelper } from "../collision";
import { MMLColor } from "../color";
import { GraphicsAdapter } from "../graphics";
import { LabelGraphics } from "../graphics";
import { Vect3 } from "../math";
import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";

export enum MLabelAlignment {
  left = "left",
  center = "center",
  right = "right",
}

const defaultLabelColor = { r: 1, g: 1, b: 1 };
const defaultFontColor = { r: 0, g: 0, b: 0 };
const defaultLabelAlignment = MLabelAlignment.left;
const defaultLabelFontSize = 24;
const defaultLabelPadding = 8;
const defaultLabelWidth = 1;
const defaultLabelHeight = 1;
const defaultLabelCastShadows = true;
const defaultEmissive = 0;

export type MLabelProps = {
  content: string;
  alignment: MLabelAlignment;
  width: number;
  height: number;
  fontSize: number;
  padding: number;
  color: MMLColor;
  fontColor: MMLColor;
  castShadows: boolean;
  emissive: number;
};

export class Label<G extends GraphicsAdapter = GraphicsAdapter> extends TransformableElement<G> {
  static tagName = "m-label";
  private labelGraphics: LabelGraphics<G> | null;
  private collideableHelper = new CollideableHelper(this);

  private labelAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    color: [
      AnimationType.Color,
      defaultLabelColor,
      (newValue: MMLColor) => {
        this.props.color = newValue;
        this.labelGraphics?.setColor(this.props.color, this.props);
      },
    ],
    "font-color": [
      AnimationType.Color,
      defaultFontColor,
      (newValue: MMLColor) => {
        this.props.fontColor = newValue;
        this.labelGraphics?.setFontColor(this.props.fontColor, this.props);
      },
    ],
    width: [
      AnimationType.Number,
      defaultLabelWidth,
      (newValue: number) => {
        this.props.width = newValue;
        this.labelGraphics?.setWidth(this.props.width, this.props);
        this.collideableHelper.updateCollider(this.labelGraphics?.getCollisionElement());
      },
    ],
    height: [
      AnimationType.Number,
      defaultLabelHeight,
      (newValue: number) => {
        this.props.height = newValue;
        this.labelGraphics?.setHeight(this.props.height, this.props);
        this.collideableHelper.updateCollider(this.labelGraphics?.getCollisionElement());
      },
    ],
    padding: [
      AnimationType.Number,
      defaultLabelPadding,
      (newValue: number) => {
        this.props.padding = newValue;
        this.labelGraphics?.setPadding(this.props.padding, this.props);
      },
    ],
    "font-size": [
      AnimationType.Number,
      defaultLabelFontSize,
      (newValue: number) => {
        this.props.fontSize = newValue;
        this.labelGraphics?.setFontSize(this.props.fontSize, this.props);
      },
    ],
  });

  public props: MLabelProps = {
    content: "",
    alignment: defaultLabelAlignment,
    width: defaultLabelWidth,
    height: defaultLabelHeight,
    fontSize: defaultLabelFontSize,
    padding: defaultLabelPadding,
    color: defaultLabelColor,
    fontColor: defaultFontColor,
    castShadows: defaultLabelCastShadows,
    emissive: defaultEmissive as number,
  };

  private static attributeHandler = new AttributeHandler<Label<GraphicsAdapter>>({
    width: (instance, newValue) => {
      instance.labelAnimatedAttributeHelper.elementSetAttribute(
        "width",
        parseFloatAttribute(newValue, defaultLabelWidth),
      );
    },
    height: (instance, newValue) => {
      instance.labelAnimatedAttributeHelper.elementSetAttribute(
        "height",
        parseFloatAttribute(newValue, defaultLabelHeight),
      );
    },
    color: (instance, newValue) => {
      instance.labelAnimatedAttributeHelper.elementSetAttribute(
        "color",
        parseColorAttribute(newValue, defaultLabelColor),
      );
    },
    "font-color": (instance, newValue) => {
      instance.labelAnimatedAttributeHelper.elementSetAttribute(
        "font-color",
        parseColorAttribute(newValue, defaultFontColor),
      );
    },
    "font-size": (instance, newValue) => {
      instance.labelAnimatedAttributeHelper.elementSetAttribute(
        "font-size",
        parseFloatAttribute(newValue, defaultLabelFontSize),
      );
    },
    padding: (instance, newValue) => {
      instance.labelAnimatedAttributeHelper.elementSetAttribute(
        "padding",
        parseFloatAttribute(newValue, defaultLabelPadding),
      );
    },
    content: (instance, newValue) => {
      instance.props.content = newValue || "";
      instance.labelGraphics?.setContent(instance.props.content, instance.props);
    },
    alignment: (instance, newValue) => {
      instance.props.alignment = parseEnumAttribute(
        newValue,
        MLabelAlignment,
        defaultLabelAlignment,
      );
      instance.labelGraphics?.setAlignment(instance.props.alignment, instance.props);
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultLabelCastShadows);
      instance.labelGraphics?.setCastShadows(instance.props.castShadows, instance.props);
    },
    emissive: (instance, newValue) => {
      instance.props.emissive = parseFloatAttribute(newValue, defaultEmissive);
      instance.labelGraphics?.setEmissive(instance.props.emissive, instance.props);
    },
  });

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Label.attributeHandler.getAttributes(),
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

    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(this.props.width, this.props.height, 0),
      this.transformableElementGraphics.getWorldMatrix(),
    );
  }

  public addSideEffectChild(child: MElement<G>): void {
    this.labelAnimatedAttributeHelper.addSideEffectChild(child);

    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.labelAnimatedAttributeHelper.removeSideEffectChild(child);

    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return true;
  }

  public attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.labelGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    Label.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.labelGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();

    this.labelGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLLabelGraphicsInterface(this);

    for (const name of Label.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.applyBounds();
    this.collideableHelper.updateCollider(this.labelGraphics?.getCollisionElement());
  }

  public disconnectedCallback(): void {
    this.collideableHelper.removeColliders();
    this.labelAnimatedAttributeHelper.reset();
    this.labelGraphics?.dispose();
    this.labelGraphics = null;
    super.disconnectedCallback();
  }
}
