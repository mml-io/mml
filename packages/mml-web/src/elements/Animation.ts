import * as THREE from "three";

import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { DebugHelper } from "../utils/DebugHelper";

// const defaultAnimationEnabled = true;
// const defaultAnimationStartTime = 0;
// const defaultAnimationDuration = 0;
const defaultAttribute: string | null = "y";
const defaultStart = 0;
const defaultEnd = 5;
const defaultStartTime = 0;
const defaultAnimDuration = 1000;

// Workaround for zero-scale values breaking audio playback in THREE PositionalAudio
function minimumNonZero(value: number): number {
  return value === 0 ? 0.000001 : value;
}

export class Animation extends MElement {
  static tagName = "m-animation";

  private props = {
    // animEnabled: defaultAnimationEnabled,
    // animStartTime: defaultAnimationStartTime,
    // animDuration: defaultAnimationDuration,
    // translateX: defaultTranslateX,
    attr: defaultAttribute,
    start: defaultStart,
    end: defaultEnd,
    startTime: defaultStartTime,
    animDuration: defaultAnimDuration,
  };

  private animationGroup: THREE.AnimationObjectGroup = new THREE.AnimationObjectGroup();
  private animationMixer: THREE.AnimationMixer = new THREE.AnimationMixer(this.animationGroup);
  private animationFrameHandle: number | null = null;
  private currentAnimation: THREE.AnimationClip | null = null;
  private registeredParentAttachment: TransformableElement | null = null;

  private static attributeHandler = new AttributeHandler<Animation>({

    // "anim-enabled": (instance, newValue) => {
    //   instance.props.animEnabled = parseBoolAttribute(newValue, defaultAnimationEnabled);
    // },
    // "anim-start-time": (instance, newValue) => {
    //   instance.props.animStartTime = parseFloatAttribute(newValue, defaultAnimationStartTime);
    // },
    // "anim-duration": (instance, newValue) => {
    //   instance.props.animDuration = parseFloatAttribute(newValue, defaultAnimationDuration);
    // },
    attr: (instance, newValue) => {
      instance.props.attr = newValue || defaultAttribute;
    },
    start: (instance, newValue) => {
      instance.props.start = parseFloatAttribute(newValue, defaultStart);
    },
    end: (instance, newValue) => {
      instance.props.end = parseFloatAttribute(newValue, defaultEnd);
    },
    "start-time": (instance, newValue) => {
      instance.props.startTime = parseFloatAttribute(newValue, defaultStartTime);
    },
    duration: (instance, newValue) => {
      instance.props.animDuration = parseFloatAttribute(newValue, defaultAnimDuration);
    },
  });


  public registerAttachment(attachment: MElement) {
    this.updateAnimation();
  }

  public unregisterAttachment(attachment: MElement) {
    this.animationGroup.remove(attachment);
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Animation.attributeHandler.getAttributes(),
    ];
  }
  constructor() {
    super();
    window.requestAnimationFrame(() => this.tick());
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return false;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Animation.attributeHandler.handle(this, name, newValue);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.animationFrameHandle = window.requestAnimationFrame(() => this.tick());
  }

  disconnectedCallback() {
    if (this.animationFrameHandle !== null) {
      window.cancelAnimationFrame(this.animationFrameHandle);
      this.animationFrameHandle = null;
    }
    super.disconnectedCallback();
  }

  private updateAnimation() {
    const docTimeMs = this.getDocumentTime() || document.timeline.currentTime || 0;
    if (this.parentElement instanceof TransformableElement) {
      // console.log("update animation", this.parentElement);
      // console.log(this.props.translateX);
      // const futureValue = parseFloat(this.parentElement.getAttribute("x")) + parseFloat(this.props.translateX);
      // console.log(this.props);
      if (this.props.attr === "x" || this.props.attr === "y" || this.props.attr === "z") {
        let parentAttrValue = this.parentElement.getAttribute(this.props.attr);
        if (parentAttrValue == null) {
          parentAttrValue = "0"; /* the default value of x, y, z is 0 if it is null */
        }
        /* new position = time now - start time / duration x (end position - start position) + start position */
        const elapsedTime = docTimeMs - this.props.startTime
        if (elapsedTime < this.props.animDuration) {
          const newPosition = (elapsedTime / this.props.animDuration * (this.props.end - this.props.start)) + this.props.start;
          this.parentElement.setAttribute(this.props.attr, newPosition.toString());
        } else {
          this.parentElement.setAttribute(this.props.attr, this.props.end.toString());
        }
      }

    }

  }
  private tick() {
    this.updateAnimation();
    this.animationFrameHandle = window.requestAnimationFrame(() => this.tick());
  }

}
