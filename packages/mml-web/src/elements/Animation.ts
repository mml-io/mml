import { AnimatedAttributeHelper } from "../attribute-animation/AnimatedAttributeHelper";
import { AttributeHandler, parseFloatAttribute } from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { GraphicsAdapter } from "../graphics";
import { AnimationGraphics } from "../graphics";
import { AnimationType } from "./AttributeAnimation";
import { AttributeLerp } from "./AttributeLerp";
import { MElement } from "./MElement";

const defaultAnimationSrc = null;
const defaultAnimationWeight = 0;

export type MAnimationProps = {
  src: string | null;
  weight: number;
};

export class Animation<G extends GraphicsAdapter = GraphicsAdapter> extends MElement<G> {
  static tagName = "m-animation";

  public props: MAnimationProps = {
    src: defaultAnimationSrc,
    weight: defaultAnimationWeight,
  };

  private animatedAttributeHelper: AnimatedAttributeHelper | null = null;

  private static attributeHandler = new AttributeHandler<Animation<GraphicsAdapter>>({
    src: (instance, newValue) => {
      instance.props.src = newValue;
      instance.animationGraphics?.setSrc(newValue, instance.props);
    },
    weight: (instance, newValue) => {
      if (instance.animatedAttributeHelper) {
        instance.animatedAttributeHelper.elementSetAttribute(
          "weight",
          parseFloatAttribute(newValue, defaultAnimationWeight),
        );
      } else {
        // fallback if AnimatedAttributeHelper isn't ready yet
        instance.props.weight = parseFloatAttribute(newValue, defaultAnimationWeight);
        instance.animationGraphics?.setWeight(instance.props.weight, instance.props);
      }
    },
  });

  public animationGraphics: AnimationGraphics<G> | null = null;

  public readonly isAnimation = true;

  public static isAnimation(element: object): element is Animation {
    return (element as Animation).isAnimation;
  }

  static get observedAttributes(): Array<string> {
    return [...Animation.attributeHandler.getAttributes()];
  }

  constructor() {
    super();
  }

  protected enable() {}

  protected disable() {}

  public getContentBounds(): OrientedBoundingBox | null {
    return null;
  }

  public parentTransformed(): void {}

  public isClickable(): boolean {
    return false;
  }

  public addSideEffectChild(child: MElement<G>): void {
    if (AttributeLerp.isAttributeLerp(child)) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.animatedAttributeHelper?.addLerp(child, attr);
      }
    }
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    if (AttributeLerp.isAttributeLerp(child)) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.animatedAttributeHelper?.removeLerp(child, attr);
      }
    }
    super.removeSideEffectChild(child);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Animation.attributeHandler.handle(this, name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.animationGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();

    this.animationGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLAnimationGraphicsInterface(this);

    // for weight lerp
    this.animatedAttributeHelper = new AnimatedAttributeHelper(this, {
      weight: [
        AnimationType.Number,
        defaultAnimationWeight,
        (value: number | null) => {
          if (value !== null) {
            this.props.weight = value;
            this.animationGraphics?.setWeight(value, this.props);
          }
        },
      ],
    });

    for (const name of Animation.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }

  disconnectedCallback() {
    this.animationGraphics?.dispose();
    this.animationGraphics = null;
    this.animatedAttributeHelper = null;
    super.disconnectedCallback();
  }
}
