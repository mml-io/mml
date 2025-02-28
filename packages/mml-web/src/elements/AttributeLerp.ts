import { easingsByName } from "../attribute-animation";
import { AttributeHandler, parseFloatAttribute } from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { lerpHSL, MMLColor } from "../color";
import { GraphicsAdapter } from "../graphics";
import { MElement } from "./MElement";

const defaultAttribute: string = "all";
const defaultEasing = "";
const defaultLerpDuration = 1000;

export class AttributeLerp<G extends GraphicsAdapter = GraphicsAdapter> extends MElement<G> {
  static tagName = "m-attr-lerp";

  private props = {
    attr: defaultAttribute,
    easing: defaultEasing,
    lerpDuration: defaultLerpDuration,
  };

  private registeredParentAttachment: MElement<G> | null = null;

  private static attributeHandler = new AttributeHandler<AttributeLerp<GraphicsAdapter>>({
    attr: (instance, newValue) => {
      if (instance.registeredParentAttachment) {
        instance.registeredParentAttachment.removeSideEffectChild(instance);
      }
      instance.props.attr = newValue !== null ? newValue : defaultAttribute;
      if (instance.registeredParentAttachment) {
        instance.registeredParentAttachment.addSideEffectChild(instance);
      }
    },
    easing: (instance, newValue) => {
      instance.props.easing = newValue || defaultEasing;
    },
    duration: (instance, newValue) => {
      instance.props.lerpDuration = Math.max(0, parseFloatAttribute(newValue, defaultLerpDuration));
    },
  });

  public readonly isAttributeLerp = true;

  public static isAttributeLerp(element: object): element is AttributeLerp {
    return (element as AttributeLerp).isAttributeLerp;
  }

  static get observedAttributes(): Array<string> {
    return [...AttributeLerp.attributeHandler.getAttributes()];
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
    AttributeLerp.attributeHandler.handle(this, name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();
    if (this.parentElement && MElement.isMElement(this.parentElement)) {
      this.registeredParentAttachment = this.parentElement as MElement<G>;
      this.registeredParentAttachment.addSideEffectChild(this);
    }
  }

  disconnectedCallback() {
    if (this.registeredParentAttachment) {
      this.registeredParentAttachment.removeSideEffectChild(this);
    }
    this.registeredParentAttachment = null;
    super.disconnectedCallback();
  }

  public getColorValueForTime(
    windowTime: number,
    elementValueSetTime: number,
    elementValue: MMLColor,
    previousValue: MMLColor,
  ) {
    const ratio = this.getLerpRatio(windowTime, elementValueSetTime);
    if (ratio >= 1) {
      return elementValue;
    }
    return lerpHSL(previousValue, elementValue, ratio);
  }

  public getFloatValueForTime(
    windowTime: number,
    elementValueSetTime: number,
    elementValue: number,
    previousValue: number,
    isDegrees: boolean,
  ) {
    let from = previousValue;
    const to = elementValue;
    const ratio = this.getLerpRatio(windowTime, elementValueSetTime);
    if (ratio >= 1) {
      return to;
    }
    if (isDegrees) {
      // Should handle going from 359 to 1 as +2 rather than -358
      if (to - from > 180) {
        from += 360;
      } else if (from - to > 180) {
        from -= 360;
      }
    }
    return from + (to - from) * ratio;
  }

  private getLerpRatio(windowTime: number, elementValueSetTime: number) {
    const duration = this.props.lerpDuration;
    const timePassed = (windowTime || 0) - elementValueSetTime;
    const ratioOfTimePassed = Math.min(timePassed / duration, 1);
    const easing = this.props.easing;
    let ratio;
    const easingFunction = easingsByName[easing];
    if (easingFunction) {
      ratio = easingFunction(ratioOfTimePassed, 0, 1, 1);
    } else {
      ratio = ratioOfTimePassed;
    }
    return ratio;
  }
}
