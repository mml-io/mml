import { AnimatedAttributeHelper } from "../attribute-animation";
import { AttributeHandler, parseBoolAttribute, parseFloatAttribute } from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { GraphicsAdapter } from "../graphics";
import { ChatProbeGraphics } from "../graphics/ChatProbeGraphics";
import { Vect3 } from "../math/Vect3";
import { getRelativePositionAndRotationRelativeToObject } from "../position";
import { IMMLScene } from "../scene";
import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";

const defaultChatProbeRange = 10;
const defaultChatProbeDebug = false;
const chatProbeChatEventName = "chat";

export type MChatProbeProps = {
  debug: boolean;
  range: number;
};

export class ChatProbe<
  G extends GraphicsAdapter = GraphicsAdapter,
> extends TransformableElement<G> {
  static tagName = "m-chat-probe";
  private chatProbeGraphics: ChatProbeGraphics<G> | null = null;
  private registeredScene: IMMLScene<G> | null = null;

  private chatProbeAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    range: [
      AnimationType.Number,
      defaultChatProbeRange,
      (newValue: number) => {
        this.props.range = newValue;
        this.chatProbeGraphics?.setRange(newValue, this.props);
        this.applyBounds();
      },
    ],
  });

  public props: MChatProbeProps = {
    debug: defaultChatProbeDebug,
    range: defaultChatProbeRange,
  };

  private static attributeHandler = new AttributeHandler<ChatProbe<GraphicsAdapter>>({
    range: (instance, newValue) => {
      instance.chatProbeAnimatedAttributeHelper.elementSetAttribute(
        "range",
        parseFloatAttribute(newValue, defaultChatProbeRange),
      );
    },
    debug: (instance, newValue) => {
      instance.props.debug = parseBoolAttribute(newValue, defaultChatProbeDebug);
      instance.chatProbeGraphics?.setDebug(instance.props.debug, instance.props);
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...ChatProbe.attributeHandler.getAttributes(),
    ];
  }

  constructor() {
    super();
  }

  protected enable() {
    // no-op (the probe only sends events if the position is within range)
  }

  protected disable() {
    // no-op (the probe only sends events if the position is within range)
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
    this.chatProbeAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.chatProbeAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    this.registeredScene?.updateChatProbe?.(this);
  }

  public isClickable(): boolean {
    return false;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    ChatProbe.attributeHandler.handle(this, name, newValue);
  }

  public trigger(message: string) {
    const userPositionAndRotation = this.getUserPositionAndRotation();
    const elementRelative = getRelativePositionAndRotationRelativeToObject(
      userPositionAndRotation,
      this,
    );

    // Check if the position is within range
    const distance = new Vect3().copy(elementRelative.position).length();

    let withinBounds = true;
    this.getAppliedBounds().forEach((bounds) => {
      if (!bounds.containsPoint(userPositionAndRotation.position)) {
        withinBounds = false;
      }
    });

    if (withinBounds && distance <= this.props.range) {
      this.dispatchEvent(
        new CustomEvent(chatProbeChatEventName, {
          detail: {
            message,
          },
        }),
      );
    }
  }

  public connectedCallback(): void {
    super.connectedCallback();

    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    if (!graphicsAdapter || this.chatProbeGraphics) {
      return;
    }

    this.chatProbeGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLChatProbeGraphicsInterface(this);

    for (const name of ChatProbe.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.applyBounds();
    this.registerChatProbe();
  }

  public disconnectedCallback(): void {
    this.unregisterChatProbe();
    this.chatProbeAnimatedAttributeHelper.reset();
    this.chatProbeGraphics?.dispose();
    this.chatProbeGraphics = null;
    super.disconnectedCallback();
  }

  private registerChatProbe() {
    const scene = this.getScene();
    this.registeredScene = scene;
    scene.addChatProbe?.(this);
  }

  private unregisterChatProbe() {
    if (this.registeredScene !== null) {
      this.registeredScene.removeChatProbe?.(this);
      this.registeredScene = null;
    }
  }
}
