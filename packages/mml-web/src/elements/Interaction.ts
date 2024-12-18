import { AnimatedAttributeHelper } from "../attribute-animation";
import { AttributeHandler, parseBoolAttribute, parseFloatAttribute } from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { GraphicsAdapter, InteractionGraphics } from "../graphics";
import { Vect3 } from "../math";
import { IMMLScene } from "../scene";
import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";

const defaultInteractionRange = 5;
const defaultInteractionInFocus = true;
const defaultInteractionLineOfSight = false;
const defaultInteractionPriority = 1;
const defaultInteractionPrompt = null;
const defaultInteractionDebug = false;

export type MInteractionProps = {
  range: number;
  inFocus: boolean;
  lineOfSight: boolean;
  priority: number;
  prompt: string | null;
  debug: boolean;
};

export class Interaction<
  G extends GraphicsAdapter = GraphicsAdapter,
> extends TransformableElement<G> {
  static tagName = "m-interaction";
  private interactionGraphics: InteractionGraphics<G> | null;

  private interactionAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    range: [
      AnimationType.Number,
      defaultInteractionRange,
      (newValue: number) => {
        this.props.range = newValue;
        this.applyBounds();
        this.interactionGraphics?.setRange(newValue, this.props);
      },
    ],
  });

  private static attributeHandler = new AttributeHandler<Interaction<GraphicsAdapter>>({
    range: (instance, newValue) => {
      instance.interactionAnimatedAttributeHelper.elementSetAttribute(
        "range",
        parseFloatAttribute(newValue, defaultInteractionRange),
      );
    },
    "in-focus": (instance, newValue) => {
      instance.props.inFocus = parseBoolAttribute(newValue, defaultInteractionInFocus);
      instance.interactionGraphics?.setInFocus(instance.props.inFocus, instance.props);
    },
    "line-of-sight": (instance, newValue) => {
      instance.props.lineOfSight = parseBoolAttribute(newValue, defaultInteractionLineOfSight);
      instance.interactionGraphics?.setLineOfSight(instance.props.lineOfSight, instance.props);
    },
    priority: (instance, newValue) => {
      instance.props.priority = parseFloatAttribute(newValue, defaultInteractionPriority);
      instance.interactionGraphics?.setPriority(instance.props.priority, instance.props);
    },
    prompt: (instance, newValue) => {
      instance.props.prompt = newValue;
      instance.interactionGraphics?.setPrompt(instance.props.prompt, instance.props);
    },
    debug: (instance, newValue) => {
      instance.props.debug = parseBoolAttribute(newValue, defaultInteractionDebug);
      instance.interactionGraphics?.setDebug(instance.props.debug, instance.props);
    },
  });
  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Interaction.attributeHandler.getAttributes(),
    ];
  }

  public props: MInteractionProps = {
    range: defaultInteractionRange as number,
    inFocus: defaultInteractionInFocus as boolean,
    lineOfSight: defaultInteractionLineOfSight as boolean,
    priority: defaultInteractionPriority as number,
    prompt: defaultInteractionPrompt as string | null,
    debug: defaultInteractionDebug as boolean,
  };

  private registeredScene: IMMLScene<G> | null = null;

  constructor() {
    super();
  }

  protected enable() {
    // TODO
  }

  protected disable() {
    // TODO
  }

  public getContentBounds(): OrientedBoundingBox | null {
    if (!this.transformableElementGraphics) {
      return null;
    }
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(this.props.range * 2, this.props.range * 2, this.props.range * 2),
      this.transformableElementGraphics.getWorldMatrix(),
    );
  }

  public addSideEffectChild(child: MElement<G>): void {
    this.interactionAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.interactionAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    this.registeredScene?.updateInteraction?.(this);
  }

  public isClickable(): boolean {
    return false;
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.interactionGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();

    this.interactionGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLInteractionGraphicsInterface(this);

    for (const name of Interaction.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.registerInteraction();
  }

  public disconnectedCallback(): void {
    this.unregisterInteraction();
    this.interactionAnimatedAttributeHelper.reset();
    this.interactionGraphics?.dispose();
    this.interactionGraphics = null;
    super.disconnectedCallback();
  }

  public attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (Interaction.attributeHandler.handle(this, name, newValue)) {
      if (this.registeredScene !== null) {
        this.registeredScene.updateInteraction?.(this);
      }
    }
  }

  public trigger() {
    this.dispatchEvent(new CustomEvent("interact", { detail: {} }));
  }

  private registerInteraction() {
    const scene = this.getScene();
    this.registeredScene = scene;
    scene.addInteraction?.(this);
  }

  private unregisterInteraction() {
    if (this.registeredScene !== null) {
      this.registeredScene.removeInteraction?.(this);
      this.registeredScene = null;
    }
  }
}
