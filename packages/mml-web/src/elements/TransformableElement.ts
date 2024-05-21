import * as THREE from "three";

import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { Model } from "./Model";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { DebugHelper } from "../utils/DebugHelper";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

// Workaround for zero-scale values breaking audio playback in THREE PositionalAudio
function minimumNonZero(value: number): number {
  return value === 0 ? 0.000001 : value;
}

const defaultVisible = true;

export abstract class TransformableElement extends MElement {
  private socketName: string | null = null;

  private desiredVisible = defaultVisible;
  private appliedBounds = new Map<unknown, OrientedBoundingBox>();
  protected directlyDisabledByBounds = false;
  protected disabledByParent = false;

  private getTransformableElementParent(): TransformableElement | null {
    let parentNode = this.parentNode;
    while (parentNode != null) {
      if (parentNode instanceof TransformableElement) {
        return parentNode;
      }
      parentNode = parentNode.parentNode;
    }
    return null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.socketName !== null) {
      this.registerWithParentModel(this.socketName);
    }

    const mElementParent = this.getTransformableElementParent();
    if (mElementParent) {
      const parentBounds = mElementParent.getAppliedBounds();
      parentBounds.forEach((orientedBox, ref) => {
        this.addOrUpdateParentBound(ref, orientedBox);
      });
      return;
    }
  }

  disconnectedCallback(): void {
    if (this.socketName !== null) {
      this.unregisterFromParentModel(this.socketName);
    }
    super.disconnectedCallback();
  }

  private animatedAttributeHelper = new AnimatedAttributeHelper(this, {
    x: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.container.position.x = newValue;
        this.didUpdateTransformation();
      },
    ],
    y: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.container.position.y = newValue;
        this.didUpdateTransformation();
      },
    ],
    z: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.container.position.z = newValue;
        this.didUpdateTransformation();
      },
    ],
    rx: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.container.rotation.x = newValue * THREE.MathUtils.DEG2RAD;
        this.didUpdateTransformation();
      },
    ],
    ry: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.container.rotation.y = newValue * THREE.MathUtils.DEG2RAD;
        this.didUpdateTransformation();
      },
    ],
    rz: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.container.rotation.z = newValue * THREE.MathUtils.DEG2RAD;
        this.didUpdateTransformation();
      },
    ],
    sx: [
      AnimationType.Number,
      1,
      (newValue: number) => {
        this.container.scale.x = minimumNonZero(newValue);
        this.didUpdateTransformation();
      },
    ],
    sy: [
      AnimationType.Number,
      1,
      (newValue: number) => {
        this.container.scale.y = minimumNonZero(newValue);
        this.didUpdateTransformation();
      },
    ],
    sz: [
      AnimationType.Number,
      1,
      (newValue: number) => {
        this.container.scale.z = minimumNonZero(newValue);
        this.didUpdateTransformation();
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
      instance.desiredVisible = parseBoolAttribute(newValue, defaultVisible);
      instance.updateVisibility();
    },
    socket: (instance, newValue) => {
      instance.handleSocketChange(newValue);
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.TransformableElementAttributeHandler.getAttributes(),
      ...DebugHelper.observedAttributes,
    ];
  }

  private debugHelper = new DebugHelper(this);

  protected abstract getContentBounds(): OrientedBoundingBox | null;

  public addSideEffectChild(child: MElement): void {
    this.animatedAttributeHelper.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    this.animatedAttributeHelper.removeSideEffectChild(child);
  }

  private handleSocketChange(socketName: string | null): void {
    if (this.isConnected && this.socketName !== socketName) {
      if (this.socketName !== null) {
        this.unregisterFromParentModel(this.socketName);
      }
      this.socketName = socketName;
      if (socketName !== null) {
        this.registerWithParentModel(socketName);
      }
    } else {
      this.socketName = socketName;
    }
  }

  private registerWithParentModel(socketName: string): void {
    if ((this.parentElement as Model | undefined)?.isModel) {
      const parentModel = this.parentElement as Model;
      parentModel.registerSocketChild(this, socketName);
    }
  }

  private unregisterFromParentModel(socketName: string): void {
    if ((this.parentElement as Model | undefined)?.isModel) {
      const parentModel = this.parentElement as Model;
      parentModel.unregisterSocketChild(this, socketName);
    }
  }

  protected applyBounds() {
    const appliedBounds = this.getAppliedBounds();
    if (appliedBounds.size > 0) {
      const thisElementBounds = this.getContentBounds();
      if (thisElementBounds) {
        for (const [, orientedBox] of appliedBounds) {
          // If the parent bound does not completely contain the element bounds then console.log
          if (!orientedBox.completelyContainsBoundingBox(thisElementBounds)) {
            if (!this.directlyDisabledByBounds) {
              this.disabledByBounds();
            }
            return;
          }
        }
      }
    }
    this.reenableByBounds();
  }

  private didUpdateTransformation() {
    this.applyBounds();
    this.parentTransformed();
    traverseImmediateTransformableElementChildren(this, (child) => {
      child.didUpdateTransformation();
    });
  }

  public attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    TransformableElement.TransformableElementAttributeHandler.handle(this, name, newValue);
    this.debugHelper.handle(name, newValue);
  }

  protected getAppliedBounds(): Map<unknown, OrientedBoundingBox> {
    return this.appliedBounds;
  }

  public addOrUpdateParentBound(ref: unknown, orientedBox: OrientedBoundingBox): void {
    this.appliedBounds.set(ref, orientedBox);
    traverseImmediateTransformableElementChildren(this, (child) => {
      child.addOrUpdateParentBound(ref, orientedBox);
    });
    this.applyBounds();
  }

  public removeParentBound(ref: unknown): void {
    this.appliedBounds.delete(ref);
    traverseImmediateTransformableElementChildren(this, (child) => {
      child.removeParentBound(ref);
    });
    this.applyBounds();
  }

  protected disabledByBounds() {
    if (this.directlyDisabledByBounds) {
      return;
    }
    this.directlyDisabledByBounds = true;
    this.updateVisibility();
    if (this.disabledByParent) {
      return;
    }
    this.disable();

    traverseImmediateTransformableElementChildren(this, (child) => {
      child.disabledByParentBounds();
    });
  }

  protected isDisabled() {
    return this.directlyDisabledByBounds || this.disabledByParent;
  }

  protected disabledByParentBounds() {
    if (this.disabledByParent) {
      return;
    }
    this.disabledByParent = true;
    this.updateVisibility();
    if (this.directlyDisabledByBounds) {
      return;
    }
    this.disable();

    traverseImmediateTransformableElementChildren(this, (child) => {
      child.disabledByParentBounds();
    });
  }

  protected abstract disable(): void;

  protected reenableByBounds() {
    if (!this.directlyDisabledByBounds) {
      return;
    }

    this.directlyDisabledByBounds = false;

    if (!this.disabledByParent) {
      this.updateVisibility();
      this.enable();

      traverseImmediateTransformableElementChildren(this, (child) => {
        child.reenableByParentBounds();
      });
    }
  }

  protected reenableByParentBounds() {
    if (!this.disabledByParent) {
      return;
    }
    this.disabledByParent = false;

    if (!this.directlyDisabledByBounds) {
      this.updateVisibility();
      this.enable();

      traverseImmediateTransformableElementChildren(this, (child) => {
        child.reenableByParentBounds();
      });
    }
  }

  protected abstract enable(): void;

  private updateVisibility() {
    this.container.visible = this.desiredVisible && !this.isDisabled();
  }
}

function traverseImmediateTransformableElementChildren(
  element: ChildNode,
  callback: (element: TransformableElement) => void,
) {
  element.childNodes.forEach((child) => {
    if (child instanceof TransformableElement) {
      callback(child);
    } else {
      traverseImmediateTransformableElementChildren(child, callback);
    }
  });
}
