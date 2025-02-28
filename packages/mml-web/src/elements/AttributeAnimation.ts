import {
  EndOfAnimationSymbol,
  getEasedRatioForTime,
  StartOfAnimationSymbol,
} from "../attribute-animation";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { lerpHSL } from "../color";
import { MMLColor } from "../color";
import { GraphicsAdapter } from "../graphics";
import { MElement } from "./MElement";

const defaultAttribute: string | null = null;
const defaultStart = 0;
const defaultEnd = 0;
const defaultLoop = true;
const defaultPingPong = false;
const defaultEasing = "";
const defaultStartTime = 0;
const defaultPauseTime = null;
const defaultAnimDuration = 1000;
const defaultPingPongDelay = 0;

export enum AnimationType {
  Number,
  Degrees, // Special handling for lerping e.g. 359 to 1
  Color,
}

const defaultColor: MMLColor = { r: 1, g: 1, b: 1 };

/*
 Attribute animations are applied with the following precedence:
  1. The first child m-attr-anim that is running (start time has passed, and duration is not exceeded / is looping)
  2. The next-to-start m-attr-anim that is not yet running (start time has not passed). If equal timing then the first occurring child is used.
  3. The last m-attr-anim to end (duration has been exceeded, and is not looping). If equal timing then the first occurring child is used.
  4. The element's attribute value.
 */

export class AttributeAnimation<G extends GraphicsAdapter = GraphicsAdapter> extends MElement<G> {
  static tagName = "m-attr-anim";

  private props = {
    attr: defaultAttribute,
    start: defaultStart as number | MMLColor,
    end: defaultEnd as number | MMLColor,
    loop: defaultLoop,
    pingPong: defaultPingPong,
    pingPongDelay: defaultPingPongDelay,
    easing: defaultEasing,
    startTime: defaultStartTime,
    pauseTime: defaultPauseTime as number | null,
    animDuration: defaultAnimDuration,
  };

  private registeredParentAttachment: MElement<G> | null = null;

  private static attributeHandler = new AttributeHandler<AttributeAnimation<GraphicsAdapter>>({
    attr: (instance, newValue) => {
      if (instance.registeredParentAttachment && instance.props.attr) {
        instance.registeredParentAttachment.removeSideEffectChild(instance);
      }
      instance.props.attr = newValue || defaultAttribute;
      if (instance.registeredParentAttachment && instance.props.attr) {
        instance.registeredParentAttachment.addSideEffectChild(instance);
      }
    },
    start: (instance, newValue) => {
      let parsedValue: number | MMLColor | null = parseFloatAttribute(newValue, null);
      if (parsedValue === null) {
        parsedValue = parseColorAttribute(newValue, null);
      }
      if (parsedValue === null) {
        instance.props.start = defaultStart;
      } else {
        instance.props.start = parsedValue;
      }
    },
    end: (instance, newValue) => {
      let parsedValue: number | MMLColor | null = parseFloatAttribute(newValue, null);
      if (parsedValue === null) {
        parsedValue = parseColorAttribute(newValue, null);
      }
      if (parsedValue === null) {
        instance.props.end = defaultStart;
      } else {
        instance.props.end = parsedValue;
      }
    },
    loop: (instance, newValue) => {
      instance.props.loop = parseBoolAttribute(newValue, defaultLoop);
    },
    "ping-pong": (instance, newValue) => {
      instance.props.pingPong = parseBoolAttribute(newValue, defaultPingPong);
    },
    "ping-pong-delay": (instance, newValue) => {
      instance.props.pingPongDelay = parseFloatAttribute(newValue, defaultPingPongDelay);
    },
    easing: (instance, newValue) => {
      instance.props.easing = newValue || defaultEasing;
    },
    "start-time": (instance, newValue) => {
      instance.props.startTime = parseFloatAttribute(newValue, defaultStartTime);
    },
    "pause-time": (instance, newValue) => {
      instance.props.pauseTime = parseFloatAttribute(newValue, defaultPauseTime);
    },
    duration: (instance, newValue) => {
      instance.props.animDuration = parseFloatAttribute(newValue, defaultAnimDuration);
    },
  });

  public readonly isAttributeAnimation = true;

  public static isAttributeAnimation(element: object): element is AttributeAnimation {
    return (element as AttributeAnimation).isAttributeAnimation;
  }

  static get observedAttributes(): Array<string> {
    return [...AttributeAnimation.attributeHandler.getAttributes()];
  }
  constructor() {
    super();
  }

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  public getContentBounds(): OrientedBoundingBox | null {
    return null;
  }

  public getAnimatedAttributeName(): string | null {
    return this.props.attr;
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return false;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    AttributeAnimation.attributeHandler.handle(this, name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();
    if (this.parentElement && MElement.isMElement(this.parentElement)) {
      this.registeredParentAttachment = this.parentElement as MElement<G>;
      if (this.props.attr) {
        this.registeredParentAttachment.addSideEffectChild(this);
      }
    }
  }

  disconnectedCallback() {
    if (this.registeredParentAttachment && this.props.attr) {
      this.registeredParentAttachment.removeSideEffectChild(this);
    }
    this.registeredParentAttachment = null;
    super.disconnectedCallback();
  }

  public getColorValueForTime(docTimeMs: number): [MMLColor, number] {
    const [ratio, state] = getEasedRatioForTime(docTimeMs, this.props);
    if (typeof this.props.start !== "object" || typeof this.props.end !== "object") {
      return [defaultColor, state];
    }
    if (ratio === StartOfAnimationSymbol) {
      return [this.props.start, state];
    } else if (ratio === EndOfAnimationSymbol) {
      return [this.props.end, state];
    } else {
      const value = lerpHSL(this.props.start, this.props.end, ratio);
      return [value, state];
    }
  }

  public getFloatValueForTime(docTimeMs: number): [number, number] {
    const [ratio, state] = getEasedRatioForTime(docTimeMs, this.props);
    if (typeof this.props.start !== "number" || typeof this.props.end !== "number") {
      return [0, state];
    }
    if (ratio === StartOfAnimationSymbol) {
      return [this.props.start as number, state];
    } else if (ratio === EndOfAnimationSymbol) {
      return [this.props.end as number, state];
    } else {
      const value = ratio * (this.props.end - this.props.start) + this.props.start;
      return [value, state];
    }
  }
}
