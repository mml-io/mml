import * as THREE from "three";

import { AnimationType, AttributeAnimation } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { DebugHelper } from "../utils/DebugHelper";

// Workaround for zero-scale values breaking audio playback in THREE PositionalAudio
function minimumNonZero(value: number): number {
  return value === 0 ? 0.000001 : value;
}

export abstract class TransformableElement extends MElement {
  private animatedAttributeHelper = new AnimatedAttributeHelper(this, {
    x: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.container.position.x = newValue;
        this.transformableAttributeChangedValue();
      },
    ],
    y: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.container.position.y = newValue;
        this.transformableAttributeChangedValue();
      },
    ],
    z: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.container.position.z = newValue;
        this.transformableAttributeChangedValue();
      },
    ],
    rx: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.container.rotation.x = newValue * THREE.MathUtils.DEG2RAD;
        this.transformableAttributeChangedValue();
      },
    ],
    ry: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.container.rotation.y = newValue * THREE.MathUtils.DEG2RAD;
        this.transformableAttributeChangedValue();
      },
    ],
    rz: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.container.rotation.z = newValue * THREE.MathUtils.DEG2RAD;
        this.transformableAttributeChangedValue();
      },
    ],
    sx: [
      AnimationType.Number,
      1,
      (newValue: number) => {
        this.container.scale.x = minimumNonZero(newValue);
        this.transformableAttributeChangedValue();
      },
    ],
    sy: [
      AnimationType.Number,
      1,
      (newValue: number) => {
        this.container.scale.y = minimumNonZero(newValue);
        this.transformableAttributeChangedValue();
      },
    ],
    sz: [
      AnimationType.Number,
      1,
      (newValue: number) => {
        this.container.scale.z = minimumNonZero(newValue);
        this.transformableAttributeChangedValue();
      },
    ],
  });
  private static TransformableElementAttributeHandler = new AttributeHandler<TransformableElement>({
    x: (instance, newValue) => {
      instance.animatedAttributeHelper.elementSetAttribute("x", parseFloatAttribute(newValue, 0));
    },
    y: (instance, newValue) => {
      instance.animatedAttributeHelper.elementSetAttribute("y", parseFloatAttribute(newValue, 0));
    },
    z: (instance, newValue) => {
      instance.animatedAttributeHelper.elementSetAttribute("z", parseFloatAttribute(newValue, 0));
    },
    rx: (instance, newValue) => {
      instance.animatedAttributeHelper.elementSetAttribute("rx", parseFloatAttribute(newValue, 0));
    },
    ry: (instance, newValue) => {
      instance.animatedAttributeHelper.elementSetAttribute("ry", parseFloatAttribute(newValue, 0));
    },
    rz: (instance, newValue) => {
      instance.animatedAttributeHelper.elementSetAttribute("rz", parseFloatAttribute(newValue, 0));
    },
    sx: (instance, newValue) => {
      instance.animatedAttributeHelper.elementSetAttribute("sx", parseFloatAttribute(newValue, 1));
    },
    sy: (instance, newValue) => {
      instance.animatedAttributeHelper.elementSetAttribute("sy", parseFloatAttribute(newValue, 1));
    },
    sz: (instance, newValue) => {
      instance.animatedAttributeHelper.elementSetAttribute("sz", parseFloatAttribute(newValue, 1));
    },
    visible: (instance, newValue) => {
      instance.container.visible = parseBoolAttribute(newValue, true);
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.TransformableElementAttributeHandler.getAttributes(),
      ...DebugHelper.observedAttributes,
    ];
  }

  private debugHelper = new DebugHelper(this);

  constructor() {
    super();
  }

  public addSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.animatedAttributeHelper.addAnimation(child, attr);
      }
    }
  }

  public removeSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.animatedAttributeHelper.removeAnimation(child, attr);
      }
    }
  }

  getBounds(): THREE.Box3 {
    return new THREE.Box3().setFromObject(this.container);
  }

  private transformableAttributeChangedValue() {
    traverseChildren(this, (child) => {
      if (child instanceof MElement) {
        child.parentTransformed();
      }
    });
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    TransformableElement.TransformableElementAttributeHandler.handle(this, name, newValue);
    this.debugHelper.handle(name, newValue);
  }
}

function traverseChildren(element: ChildNode, callback: (element: ChildNode) => void) {
  element.childNodes.forEach((child) => {
    callback(child);
    traverseChildren(child, callback);
  });
}
