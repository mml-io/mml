import { AnimationType, AttributeAnimation } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { Model } from "./Model";
import { Matr4 } from "../math/Matr4";
import { Quat } from "../math/Quat";
import { TransformableGraphics } from "../MMLGraphicsInterface";
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

export type TransformableElementProps = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  sx: number;
  sy: number;
  sz: number;
};

export abstract class TransformableElement extends MElement {
  private static tempQuat = new Quat();
  private socketName: string | null = null;

  private transformableElementProps: TransformableElementProps = {
    x: 0,
    y: 0,
    z: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    sx: 1,
    sy: 1,
    sz: 1,
  };

  private desiredVisible = defaultVisible;
  private appliedBounds = new Map<unknown, OrientedBoundingBox>();
  protected directlyDisabledByBounds = false;
  protected disabledByParent = false;

  private transformableElementGraphics?: TransformableGraphics;

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

  calculateLocalMatrix(matrix: Matr4): void {
    const pos = {
      x: this.transformableElementProps.x,
      y: this.transformableElementProps.y,
      z: this.transformableElementProps.z,
    };
    const eulerXYZRotation = {
      x: this.transformableElementProps.rx,
      y: this.transformableElementProps.ry,
      z: this.transformableElementProps.rz,
    };
    const scale = {
      x: this.transformableElementProps.sx,
      y: this.transformableElementProps.sy,
      z: this.transformableElementProps.sz,
    };
    const quaternion = TransformableElement.tempQuat;
    quaternion.setFromEulerXYZ(eulerXYZRotation);
    matrix.compose(pos, quaternion, scale);
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.transformableElementGraphics =
      new (this.getScene().getGraphicsAdapterFactory().MMLTransformableGraphicsInterface)(this);

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
    this.transformableElementGraphics?.dispose();
    this.transformableElementGraphics = undefined;
    super.disconnectedCallback();
  }

  private animatedAttributeHelper = new AnimatedAttributeHelper(this, {
    x: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.transformableElementProps.x = newValue;
        this.transformableElementGraphics?.setX(newValue, this.transformableElementProps);
        this.didUpdateTransformation();
      },
    ],
    y: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.transformableElementProps.y = newValue;
        this.transformableElementGraphics?.setY(newValue, this.transformableElementProps);
        this.didUpdateTransformation();
      },
    ],
    z: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.transformableElementProps.z = newValue;
        this.transformableElementGraphics?.setZ(newValue, this.transformableElementProps);
        this.didUpdateTransformation();
      },
    ],
    rx: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.transformableElementProps.rx = newValue;
        this.transformableElementGraphics?.setRotationX(newValue, this.transformableElementProps);
        this.didUpdateTransformation();
      },
    ],
    ry: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.transformableElementProps.ry = newValue;
        this.transformableElementGraphics?.setRotationY(newValue, this.transformableElementProps);
        this.didUpdateTransformation();
      },
    ],
    rz: [
      AnimationType.Number,
      0,
      (newValue: number) => {
        this.transformableElementProps.rz = newValue;
        this.transformableElementGraphics?.setRotationZ(newValue, this.transformableElementProps);
        this.didUpdateTransformation();
      },
    ],
    sx: [
      AnimationType.Number,
      1,
      (newValue: number) => {
        this.transformableElementProps.sx = newValue;
        this.transformableElementGraphics?.setScaleX(
          minimumNonZero(newValue),
          this.transformableElementProps,
        );
        this.didUpdateTransformation();
      },
    ],
    sy: [
      AnimationType.Number,
      1,
      (newValue: number) => {
        this.transformableElementProps.sy = newValue;
        this.transformableElementGraphics?.setScaleY(
          minimumNonZero(newValue),
          this.transformableElementProps,
        );
        this.didUpdateTransformation();
      },
    ],
    sz: [
      AnimationType.Number,
      1,
      (newValue: number) => {
        this.transformableElementProps.sz = newValue;
        this.transformableElementGraphics?.setScaleZ(
          minimumNonZero(newValue),
          this.transformableElementProps,
        );
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

  public attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
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
    this.transformableElementGraphics?.setVisibility(this.desiredVisible && !this.isDisabled());
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
