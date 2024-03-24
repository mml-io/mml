import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import { AttributeHandler, parseFloatAttribute } from "../utils/attribute-handling";
import { StaticHTMLFrameInstance } from "../utils/frame/StaticHTMLFrameInstance";
import { WebSocketFrameInstance } from "../utils/frame/WebSocketFrameInstance";
import { getRelativePositionAndRotationRelativeToObject } from "../utils/position-utils";

const defaultHysteresis = 0;

export class Frame extends TransformableElement {
  static tagName = "m-frame";

  private static attributeHandler = new AttributeHandler<Frame>({
    src: (instance, newValue) => {
      instance.src = newValue;
      if (instance.frameContentsInstance) {
        instance.disposeInstance();
      }
      if (instance.src && instance.isConnected) {
        instance.createFrameContentsInstance(instance.src);
      }
    },
    "load-range": (instance, newValue) => {
      instance.loadRange = parseFloatAttribute(newValue, null);
      instance.syncLoadState();
    },
    hysteresis: (instance, newValue) => {
      instance.hysteresis = parseFloatAttribute(newValue, defaultHysteresis);
      instance.syncLoadState();
    },
  });

  private frameContentsInstance: WebSocketFrameInstance | StaticHTMLFrameInstance | null = null;
  private src: string | null = null;
  private loadRange: number | null = null;
  private hysteresis: number = defaultHysteresis;
  private isActivelyLoaded = true; // Defaults to true because the frame should be trying to be loaded unless there is a range specified
  private timer: NodeJS.Timeout | null = null;

  private shouldBeLoaded() {
    if (!this.isConnected) {
      return false;
    }
    if (this.loadRange === null) {
      return true;
    }

    const userPositionAndRotation = this.getUserPositionAndRotation();
    const elementRelative = getRelativePositionAndRotationRelativeToObject(
      userPositionAndRotation,
      this.getContainer(),
    );

    // Check if the position is within range
    const distance = new THREE.Vector3().copy(elementRelative.position as THREE.Vector3).length();
    if (distance <= this.loadRange) {
      return true;
    }
    if (distance > this.loadRange + this.hysteresis) {
      return false;
    }
    // If the distance is within the hysteresis range, keep the current state
    return this.isActivelyLoaded;
  }

  private syncLoadState() {
    const shouldBeLoaded = this.shouldBeLoaded();
    if (shouldBeLoaded && !this.isActivelyLoaded) {
      this.isActivelyLoaded = true;
      if (this.src) {
        this.createFrameContentsInstance(this.src);
      }
    } else if (!shouldBeLoaded && this.isActivelyLoaded) {
      this.isActivelyLoaded = false;
      this.disposeInstance();
    }
  }

  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes, ...Frame.attributeHandler.getAttributes()];
  }

  constructor() {
    super();
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return true;
  }

  connectedCallback() {
    super.connectedCallback();
    this.startEmitting();
    if (this.src) {
      this.createFrameContentsInstance(this.src);
    }
  }

  disconnectedCallback() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.disposeInstance();
    super.disconnectedCallback();
  }

  private startEmitting() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      this.syncLoadState();
    }, 1000);
  }

  private createFrameContentsInstance(src: string) {
    if (this.frameContentsInstance) {
      // TODO - avoid calling this if the instance already exists - this is a hack to avoid duplicating frames
      if (this.frameContentsInstance.src !== src) {
        console.error("Instance already existed with a different src");
        this.disposeInstance();
      } else {
        return;
      }
    }

    if (src.startsWith("ws://") || src.startsWith("wss://")) {
      this.frameContentsInstance = new WebSocketFrameInstance(this, src, this.getScene());
    } else {
      this.frameContentsInstance = new StaticHTMLFrameInstance(this, src, this.getScene());
    }
    this.container.add(this.frameContentsInstance.container);
  }

  private disposeInstance() {
    if (this.frameContentsInstance !== null) {
      this.container.remove(this.frameContentsInstance.container);
      this.frameContentsInstance.dispose();
      this.frameContentsInstance = null;
    }
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Frame.attributeHandler.handle(this, name, newValue);
  }
}
