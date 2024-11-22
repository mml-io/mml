import { AnimatedAttributeHelper } from "../attribute-animation";
import { AttributeHandler, parseBoolAttribute, parseFloatAttribute } from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { CollideableHelper } from "../collision";
import { GraphicsAdapter, VideoGraphics } from "../graphics";
import { Vect3 } from "../math";
import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";

const defaultVideoWidth = null;
const defaultVideoHeight = null;
const defaultVideoVolume = 1;
const defaultVideoLoop = true;
const defaultVideoEnabled = true;
const defaultVideoStartTime = 0;
const defaultVideoPauseTime = null;
const defaultVideoSrc = null;
const defaultVideoCastShadows = true;
const defaultVideoEmissive = 0;

export type MVideoProps = {
  width: number | null;
  height: number | null;
  enabled: boolean;
  loop: boolean;
  startTime: number;
  pauseTime: number | null;
  src: string | null;
  volume: number;
  castShadows: boolean;
  emissive: number;
};

export class Video<G extends GraphicsAdapter = GraphicsAdapter> extends TransformableElement<G> {
  static tagName = "m-video";

  private videoAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    width: [
      AnimationType.Number,
      defaultVideoWidth,
      (newValue: number) => {
        this.props.width = newValue;
        this.videoGraphics?.setWidth(newValue, this.props);
      },
    ],
    height: [
      AnimationType.Number,
      defaultVideoHeight,
      (newValue: number) => {
        this.props.height = newValue;
        this.videoGraphics?.setHeight(newValue, this.props);
      },
    ],
    emissive: [
      AnimationType.Number,
      defaultVideoEmissive,
      (newValue: number) => {
        this.props.emissive = newValue;
        this.videoGraphics?.setEmissive(newValue, this.props);
      },
    ],
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Video.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  private documentTimeListener: { remove: () => void };
  private collideableHelper = new CollideableHelper(this);

  // Parsed attribute values
  public props: MVideoProps = {
    startTime: defaultVideoStartTime,
    pauseTime: defaultVideoPauseTime,
    src: defaultVideoSrc,
    loop: defaultVideoLoop,
    enabled: defaultVideoEnabled,
    volume: defaultVideoVolume,
    width: defaultVideoWidth,
    height: defaultVideoHeight,
    castShadows: defaultVideoCastShadows,
    emissive: defaultVideoEmissive,
  };

  private static attributeHandler = new AttributeHandler<Video<GraphicsAdapter>>({
    width: (instance, newValue) => {
      instance.videoAnimatedAttributeHelper.elementSetAttribute(
        "width",
        parseFloatAttribute(newValue, defaultVideoWidth),
      );
    },
    height: (instance, newValue) => {
      instance.videoAnimatedAttributeHelper.elementSetAttribute(
        "height",
        parseFloatAttribute(newValue, defaultVideoHeight),
      );
    },
    enabled: (instance, newValue) => {
      instance.props.enabled = parseBoolAttribute(newValue, defaultVideoEnabled);
      instance.videoGraphics?.setEnabled(instance.props.enabled, instance.props);
    },
    loop: (instance, newValue) => {
      instance.props.loop = parseBoolAttribute(newValue, defaultVideoLoop);
      instance.videoGraphics?.setLoop(instance.props.loop, instance.props);
    },
    "start-time": (instance, newValue) => {
      instance.props.startTime = parseFloatAttribute(newValue, defaultVideoStartTime);
      instance.videoGraphics?.setStartTime(instance.props.startTime, instance.props);
    },
    "pause-time": (instance, newValue) => {
      instance.props.pauseTime = parseFloatAttribute(newValue, defaultVideoPauseTime);
      instance.videoGraphics?.setPauseTime(instance.props.pauseTime, instance.props);
    },
    src: (instance, newValue) => {
      instance.props.src = newValue;
      instance.videoGraphics?.setSrc(newValue, instance.props);
    },
    volume: (instance, newValue) => {
      instance.props.volume = parseFloatAttribute(newValue, defaultVideoVolume);
      instance.videoGraphics?.setVolume(instance.props.volume, instance.props);
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultVideoCastShadows);
      instance.videoGraphics?.setCastShadows(instance.props.castShadows, instance.props);
    },
    emissive: (instance, newValue) => {
      instance.videoAnimatedAttributeHelper.elementSetAttribute(
        "emissive",
        parseFloatAttribute(newValue, defaultVideoEmissive),
      );
    },
  });
  private videoGraphics: VideoGraphics<G> | null;

  protected enable() {
    this.videoGraphics?.syncVideoTime();
  }

  protected disable() {
    this.videoGraphics?.syncVideoTime();
  }

  constructor() {
    super();
  }

  public getContentBounds(): OrientedBoundingBox | null {
    if (!this.videoGraphics || !this.transformableElementGraphics) {
      return null;
    }
    const { width, height } = this.videoGraphics.getWidthAndHeight() || { width: 0, height: 0 };
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(width, height, 0),
      this.transformableElementGraphics.getWorldMatrix(),
    );
  }

  public addSideEffectChild(child: MElement<G>): void {
    this.videoAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.videoAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.videoGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    Video.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  private documentTimeChanged() {
    this.videoGraphics?.syncVideoTime();
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.videoGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();

    this.videoGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLVideoGraphicsInterface(this, () => {
        this.applyBounds();
        this.collideableHelper.updateCollider(this.videoGraphics?.getCollisionElement());
      });

    this.documentTimeListener = this.addDocumentTimeListener(() => {
      this.documentTimeChanged();
    });

    for (const name of Video.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.collideableHelper.updateCollider(this.videoGraphics?.getCollisionElement());
  }

  disconnectedCallback() {
    this.videoAnimatedAttributeHelper.reset();
    this.videoGraphics?.dispose();
    this.videoGraphics = null;
    this.documentTimeListener.remove();
    this.collideableHelper.removeColliders();
    super.disconnectedCallback();
  }
}
