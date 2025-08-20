import { AttributeHandler, parseBoolAttribute, parseFloatAttribute } from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { CollideableHelper } from "../collision";
import { GraphicsAdapter, ModelGraphics } from "../graphics";
import { Animation } from "./Animation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";

const defaultModelSrc = null;
const defaultModelAnim = null;
const defaultModelAnimLoop = true;
const defaultModelAnimEnabled = true;
const defaultModelAnimStartTime = 0;
const defaultModelAnimPauseTime = null;
const defaultModelCastShadows = true;
const defaultModelDebug = false;

export type MModelProps = {
  src: string | null;
  anim: string | null;
  animLoop: boolean;
  animEnabled: boolean;
  animStartTime: number;
  animPauseTime: number | null;
  castShadows: boolean;
  debug: boolean;
};

export class Model<G extends GraphicsAdapter = GraphicsAdapter> extends TransformableElement<G> {
  static tagName = "m-model";

  public props: MModelProps = {
    src: defaultModelSrc,
    anim: defaultModelAnim,
    animStartTime: defaultModelAnimStartTime,
    animPauseTime: defaultModelAnimPauseTime as number | null,
    animLoop: defaultModelAnimLoop,
    animEnabled: defaultModelAnimEnabled,
    castShadows: defaultModelCastShadows,
    debug: defaultModelDebug,
  };

  private collideableHelper = new CollideableHelper(this);

  private static attributeHandler = new AttributeHandler<Model<GraphicsAdapter>>({
    src: (instance, newValue) => {
      instance.props.src = newValue;
      instance.modelGraphics?.setSrc(newValue, instance.props);
    },
    anim: (instance, newValue) => {
      instance.props.anim = newValue;
      instance.modelGraphics?.setAnim(newValue, instance.props);
    },
    debug: (instance, newValue) => {
      instance.props.debug = parseBoolAttribute(newValue, defaultModelDebug);
      instance.modelGraphics?.setDebug(instance.props.debug, instance.props);
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultModelCastShadows);
      instance.modelGraphics?.setCastShadows(instance.props.castShadows, instance.props);
    },
    "anim-enabled": (instance, newValue) => {
      instance.props.animEnabled = parseBoolAttribute(newValue, defaultModelAnimEnabled);
      instance.modelGraphics?.setAnimEnabled(instance.props.animEnabled, instance.props);
    },
    "anim-loop": (instance, newValue) => {
      instance.props.animLoop = parseBoolAttribute(newValue, defaultModelAnimLoop);
      instance.modelGraphics?.setAnimLoop(instance.props.animLoop, instance.props);
    },
    "anim-start-time": (instance, newValue) => {
      instance.props.animStartTime = parseFloatAttribute(newValue, defaultModelAnimStartTime);
      instance.modelGraphics?.setAnimStartTime(instance.props.animStartTime, instance.props);
    },
    "anim-pause-time": (instance, newValue) => {
      instance.props.animPauseTime = parseFloatAttribute(newValue, defaultModelAnimPauseTime);
      instance.modelGraphics?.setAnimPauseTime(instance.props.animPauseTime, instance.props);
    },
  });

  public modelGraphics: ModelGraphics<G> | null = null;

  public readonly isModel = true;

  public static isModel(element: object): element is Model {
    return (element as Model).isModel;
  }

  protected enable() {
    this.collideableHelper.enable();
  }

  protected disable() {
    this.collideableHelper.disable();
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Model.attributeHandler.getAttributes(),
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
    const boundingBox = this.modelGraphics?.getBoundingBox();
    if (boundingBox) {
      return OrientedBoundingBox.fromSizeMatrixWorldAndCenter(
        boundingBox.size,
        this.transformableElementGraphics.getWorldMatrix(),
        boundingBox.centerOffset,
      );
    }
    return null;
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
    this.modelGraphics?.transformed();
  }

  public isClickable(): boolean {
    return true;
  }

  public addSideEffectChild(child: MElement<G>): void {
    // Handle child animations
    if (Animation.isAnimation(child)) {
      // When an animation is added, we need to wait for it to load and then update the model
      // The animation will call updateChildAnimation when it's ready via its graphics adapter

      // If the modelGraphics is already ready, notify it immediately
      if (this.modelGraphics && child.animationGraphics) {
        const weight = child.props.weight;
        child.animationGraphics.setWeight(weight, child.props);
      }
    } else {
      // For other side effect children, delegate to parent
      super.addSideEffectChild(child);
    }
  }

  public removeSideEffectChild(child: MElement<G>): void {
    // Handle child animation removal
    if (Animation.isAnimation(child)) {
      // Notify the graphics adapter that this animation should be removed
      this.modelGraphics?.removeChildAnimation?.(child);
    } else {
      // For other side effect children, delegate to parent
      super.removeSideEffectChild(child);
    }
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.modelGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    Model.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
    if (TransformableElement.observedAttributes.includes(name)) {
      // The element might have moved/scaled, so we need to call transformed
      this.modelGraphics.transformed();
    }
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.modelGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();

    this.modelGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLModelGraphicsInterface(this, () => {
        this.applyBounds();
        this.collideableHelper.updateCollider(this.modelGraphics?.getCollisionElement());
      });

    // Notify any existing child animations that the modelGraphics is now available
    this.notifyChildAnimations();

    for (const name of Model.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }

  private notifyChildAnimations() {
    // Find all child animations and notify them that the modelGraphics is ready
    const childAnimations = this.querySelectorAll("m-animation");

    childAnimations.forEach((animation) => {
      if (Animation.isAnimation(animation)) {
        // The animation's graphics adapter will handle the notification
        if (animation.animationGraphics) {
          // Force a weight update to trigger the animation registration
          const weight = animation.props.weight;
          animation.animationGraphics.setWeight(weight, animation.props);
        }
      }
    });
  }

  disconnectedCallback() {
    // stop listening to document time ticking
    this.collideableHelper.removeColliders();
    this.modelGraphics?.dispose();
    this.modelGraphics = null;
    super.disconnectedCallback();
  }
}
