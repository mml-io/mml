import { AnimatedAttributeHelper } from "../attribute-animation/AnimatedAttributeHelper";
import { AttributeHandler, parseBoolAttribute, parseFloatAttribute } from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { GraphicsAdapter } from "../graphics";
import { AnimationGraphics } from "../graphics";
import { AnimationType } from "./AttributeAnimation";
import { AttributeLerp } from "./AttributeLerp";
import { MElement } from "./MElement";
import { Model } from "./Model";

const defaultAnimationSrc = null;
const defaultAnimationWeight = 1;
const defaultAnimationSpeed = 1;
const defaultAnimationLoop = true;
const defaultAnimationStartTime = 0;
const defaultAnimationPauseTime = null;
const defaultAnimationRatio = null;

export type MAnimationProps = {
  src: string | null;
  weight: number;
  speed: number;
  ratio: number | null;
  loop: boolean;
  startTime: number;
  pauseTime: number | null;
};

export class Animation<G extends GraphicsAdapter = GraphicsAdapter> extends MElement<G> {
  static tagName = "m-animation";

  public props: MAnimationProps = {
    src: defaultAnimationSrc,
    weight: defaultAnimationWeight,
    speed: defaultAnimationSpeed,
    ratio: defaultAnimationRatio,
    loop: defaultAnimationLoop,
    startTime: defaultAnimationStartTime,
    pauseTime: defaultAnimationPauseTime,
  };

  private animatedAttributeHelper = new AnimatedAttributeHelper(this, {
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
    ratio: [
      AnimationType.Number,
      defaultAnimationRatio,
      (value: number | null) => {
        this.props.ratio = value;
        this.animationGraphics?.setRatio(value, this.props);
      },
    ],
  });

  private static attributeHandler = new AttributeHandler<Animation<GraphicsAdapter>>({
    src: (instance, newValue) => {
      instance.props.src = newValue;
      instance.animationGraphics?.setSrc(newValue, instance.props);
    },
    weight: (instance, newValue) => {
      instance.animatedAttributeHelper.elementSetAttribute(
        "weight",
        parseFloatAttribute(newValue, defaultAnimationWeight),
      );
    },
    ratio: (instance, newValue) => {
      instance.animatedAttributeHelper.elementSetAttribute(
        "ratio",
        parseFloatAttribute(newValue, defaultAnimationRatio),
      );
    },
    speed: (instance, newValue) => {
      instance.props.speed = parseFloatAttribute(newValue, defaultAnimationSpeed);
      instance.animationGraphics?.setSpeed(instance.props.speed, instance.props);
    },
    loop: (instance, newValue) => {
      instance.props.loop = parseBoolAttribute(newValue, defaultAnimationLoop);
      instance.animationGraphics?.setLoop(instance.props.loop, instance.props);
    },
    "start-time": (instance, newValue) => {
      instance.props.startTime = parseFloatAttribute(newValue, defaultAnimationStartTime);
      instance.animationGraphics?.setStartTime(instance.props.startTime, instance.props);
    },
    "pause-time": (instance, newValue) => {
      instance.props.pauseTime = parseFloatAttribute(newValue, defaultAnimationPauseTime);
      instance.animationGraphics?.setPauseTime(instance.props.pauseTime, instance.props);
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
    this.animatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.animatedAttributeHelper.removeSideEffectChild(child);
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

    if (this.parentElement && Model.isModel(this.parentElement)) {
      this.parentElement.addSideEffectChild(this);
    }

    // Process attributes in the correct order: src first, then weight
    for (const name of Animation.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    // Ensure the initial weight is set immediately after src is processed
    const weightValue = this.getAttribute("weight");
    if (weightValue !== null) {
      const parsedWeight = parseFloatAttribute(weightValue, defaultAnimationWeight);
      this.props.weight = parsedWeight;
      // Set the weight directly on the graphics adapter to ensure immediate application
      this.animationGraphics?.setWeight(parsedWeight, this.props);
    }
  }

  disconnectedCallback() {
    if (this.parentElement && Model.isModel(this.parentElement)) {
      this.parentElement.removeSideEffectChild(this);
    }
    this.animatedAttributeHelper?.reset();
    this.animationGraphics?.dispose();
    this.animationGraphics = null;
    super.disconnectedCallback();
  }
}
