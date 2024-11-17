import { AnimatedAttributeHelper } from "../attribute-animation";
import { AttributeHandler, parseBoolAttribute, parseFloatAttribute } from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { GraphicsAdapter } from "../graphics";
import { AudioGraphics } from "../graphics/AudioGraphics";
import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";

const defaultAudioVolume = 1;
const defaultAudioLoop = true;
const defaultAudioEnabled = true;
const defaultAudioStartTime = 0;
const defaultAudioPauseTime = null;
const defaultAudioSrc = null;
const defaultAudioInnerConeAngle: number = 360;
const defaultAudioOuterConeAngle = 0;
const defaultAudioDebug = false;

function clampAudioConeAngle(angle: number) {
  return Math.max(Math.min(angle, 360), 0);
}

export type MAudioProps = {
  src: string | null;
  startTime: number;
  pauseTime: number | null;
  loop: boolean;
  loopDuration: number | null;
  enabled: boolean;
  volume: number;
  coneAngle: number;
  coneFalloffAngle: number | null;
  debug: boolean;
};

export class Audio<G extends GraphicsAdapter = GraphicsAdapter> extends TransformableElement<G> {
  static tagName = "m-audio";

  public props: MAudioProps = {
    src: defaultAudioSrc as string | null,
    startTime: defaultAudioStartTime,
    pauseTime: defaultAudioPauseTime as number | null,
    loop: defaultAudioLoop,
    loopDuration: null,
    enabled: defaultAudioEnabled,
    volume: defaultAudioVolume,
    coneAngle: defaultAudioInnerConeAngle,
    coneFalloffAngle: defaultAudioOuterConeAngle as number | null,
    debug: false,
  };

  private audioGraphics: AudioGraphics<G> | null = null;

  private audioAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    volume: [
      AnimationType.Number,
      defaultAudioVolume,
      (newValue: number) => {
        this.props.volume = newValue;
        this.audioGraphics?.setVolume(newValue, this.props);
      },
    ],
    "cone-angle": [
      AnimationType.Number,
      defaultAudioInnerConeAngle,
      (newValue: number | null) => {
        this.props.coneAngle =
          newValue === null ? defaultAudioInnerConeAngle : clampAudioConeAngle(newValue);
        this.audioGraphics?.setConeAngle(this.props.coneAngle, this.props);
      },
    ],
    "cone-falloff-angle": [
      AnimationType.Number,
      defaultAudioOuterConeAngle,
      (newValue: number) => {
        this.props.coneFalloffAngle = clampAudioConeAngle(newValue);
        this.audioGraphics?.setConeFalloffAngle(this.props.coneFalloffAngle, this.props);
      },
    ],
  });

  private documentTimeListener: { remove: () => void };

  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes, ...Audio.attributeHandler.getAttributes()];
  }

  private static attributeHandler = new AttributeHandler<Audio<GraphicsAdapter>>({
    enabled: (instance, newValue) => {
      instance.props.enabled = parseBoolAttribute(newValue, defaultAudioEnabled);
      instance.audioGraphics?.setEnabled(instance.props.enabled, instance.props);
    },
    loop: (instance, newValue) => {
      instance.props.loop = parseBoolAttribute(newValue, defaultAudioLoop);
      instance.audioGraphics?.setLoop(instance.props.loop, instance.props);
    },
    "loop-duration": (instance, newValue) => {
      instance.props.loopDuration = parseFloatAttribute(newValue, null);
      instance.audioGraphics?.setLoopDuration(instance.props.loopDuration, instance.props);
    },
    "start-time": (instance, newValue) => {
      instance.props.startTime = parseFloatAttribute(newValue, defaultAudioStartTime);
      instance.audioGraphics?.setStartTime(instance.props.startTime, instance.props);
    },
    "pause-time": (instance, newValue) => {
      instance.props.pauseTime = parseFloatAttribute(newValue, defaultAudioPauseTime);
      instance.audioGraphics?.setPauseTime(instance.props.pauseTime, instance.props);
    },
    src: (instance, newValue) => {
      instance.props.src = newValue;
      instance.audioGraphics?.setSrc(newValue, instance.props);
    },
    volume: (instance, newValue) => {
      instance.audioAnimatedAttributeHelper.elementSetAttribute(
        "volume",
        parseFloatAttribute(newValue, defaultAudioVolume),
      );
    },
    "cone-angle": (instance, newValue) => {
      instance.audioAnimatedAttributeHelper.elementSetAttribute(
        "cone-angle",
        parseFloatAttribute(newValue, null),
      );
    },
    "cone-falloff-angle": (instance, newValue) => {
      instance.audioAnimatedAttributeHelper.elementSetAttribute(
        "cone-falloff-angle",
        parseFloatAttribute(newValue, defaultAudioOuterConeAngle),
      );
    },
    debug: (instance, newValue) => {
      instance.props.debug = parseBoolAttribute(newValue, defaultAudioDebug);
      instance.audioGraphics?.setDebug(instance.props.debug, instance.props);
    },
  });

  constructor() {
    super();
  }

  protected enable() {
    this.audioGraphics?.syncAudioTime();
  }

  protected disable() {
    this.audioGraphics?.syncAudioTime();
  }

  public getContentBounds(): OrientedBoundingBox | null {
    if (!this.transformableElementGraphics) {
      return null;
    }
    return OrientedBoundingBox.fromMatrixWorld(this.transformableElementGraphics.getWorldMatrix());
  }

  public addSideEffectChild(child: MElement<G>): void {
    this.audioAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.audioAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return true;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.audioGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    Audio.attributeHandler.handle(this, name, newValue);
  }

  private documentTimeChanged() {
    this.audioGraphics?.syncAudioTime();
  }

  public connectedCallback(): void {
    super.connectedCallback();

    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    if (!graphicsAdapter || this.audioGraphics) {
      return;
    }

    this.audioGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLAudioGraphicsInterface(this);

    this.documentTimeListener = this.addDocumentTimeListener(() => {
      this.documentTimeChanged();
    });

    for (const name of Audio.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }

  disconnectedCallback() {
    this.audioAnimatedAttributeHelper.reset();
    this.audioGraphics?.dispose();
    this.audioGraphics = null;
    this.documentTimeListener.remove();
    super.disconnectedCallback();
  }
}
