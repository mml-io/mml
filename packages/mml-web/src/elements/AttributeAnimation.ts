import * as THREE from "three";

import { MElement } from "./MElement";
import {
  EndOfAnimationSymbol,
  getEasedRatioForTime,
  StartOfAnimationSymbol,
} from "../utils/animation-timings";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

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
  Color,
}

const defaultColor = new THREE.Color(0xffffff);

/*
 Attribute animations are applied with the following precedence:
  1. The first child m-attr-anim that is running (start time has passed, and duration is not exceeded / is looping)
  2. The next-to-start m-attr-anim that is not yet running (start time has not passed). If equal timing then the first occurring child is used.
  3. The last m-attr-anim to end (duration has been exceeded, and is not looping). If equal timing then the first occurring child is used.
  4. The element's attribute value.
 */

export class AttributeAnimation extends MElement {
  static tagName = "m-attr-anim";

  private props = {
    attr: defaultAttribute,
    start: defaultStart as number | THREE.Color,
    end: defaultEnd as number | THREE.Color,
    loop: defaultLoop,
    pingPong: defaultPingPong,
    pingPongDelay: defaultPingPongDelay,
    easing: defaultEasing,
    startTime: defaultStartTime,
    pauseTime: defaultPauseTime as number | null,
    animDuration: defaultAnimDuration,
  };

  private registeredParentAttachment: MElement | null = null;

  private static attributeHandler = new AttributeHandler<AttributeAnimation>({
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
      let parsedValue: number | THREE.Color | null = parseFloatAttribute(newValue, null);
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
      let parsedValue: number | THREE.Color | null = parseFloatAttribute(newValue, null);
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
      instance.props.animDuration = Math.max(0, parseFloatAttribute(newValue, defaultAnimDuration));
    },
  });

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

  protected getContentBounds(): OrientedBoundingBox | null {
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

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    AttributeAnimation.attributeHandler.handle(this, name, newValue);
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.parentElement && this.parentElement instanceof MElement) {
      this.registeredParentAttachment = this.parentElement;
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

  public getColorValueForTime(docTimeMs: number): [THREE.Color, number] {
    const [ratio, state] = getEasedRatioForTime(docTimeMs, this.props);
    if (!(this.props.start instanceof THREE.Color) || !(this.props.end instanceof THREE.Color)) {
      // TODO - this is just showing a default color rather than "failing" the animation and falling back to the element
      return [defaultColor, state];
    }
    if (ratio === StartOfAnimationSymbol) {
      return [this.props.start, state];
    } else if (ratio === EndOfAnimationSymbol) {
      return [this.props.end, state];
    } else {
      const value = new THREE.Color(this.props.start).lerpHSL(this.props.end, ratio);
      return [value, state];
    }
  }

  public getFloatValueForTime(docTimeMs: number): [number, number] {
    const [ratio, state] = getEasedRatioForTime(docTimeMs, this.props);
    if (this.props.start instanceof THREE.Color || this.props.end instanceof THREE.Color) {
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
