import * as THREE from "three";

import { AnimationType, AttributeAnimation } from "./AttributeAnimation";
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

function OBBcontainsOBB(containingOBB: OrientedBoundingBox, childOBB: OrientedBoundingBox) {
  const points: Array<THREE.Vector3> = [];
  const size = childOBB.size;

  containingOBB.matrixWorldProvider.updateMatrixWorld(true);
  childOBB.matrixWorldProvider.updateMatrixWorld(true);

  for (let x = -1; x <= 1; x += 2) {
    for (let y = -1; y <= 1; y += 2) {
      for (let z = -1; z <= 1; z += 2) {
        points.push(
          new THREE.Vector3(x * (size.x / 2), y * (size.y / 2), z * (size.z / 2)).applyMatrix4(
            childOBB.matrixWorldProvider.matrixWorld,
          ),
        );
      }
    }
  }

  // then we check if all of these points are inside obb1
  return points.every((point) => containingOBB.containsPoint(point));
}

export abstract class TransformableElement extends MElement {
  private socketName: string | null = null;

  connectedCallback(): void {
    console.log("TransformableElement.connectedCallback", this.tagName);
    super.connectedCallback();
    if (this.socketName !== null) {
      this.registerWithParentModel(this.socketName);
    }
    console.log("TransformableElement.connectedCallback.done", this.tagName);
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
      instance.container.visible = parseBoolAttribute(newValue, true);
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

  private originalParentBounds = new Map<unknown, OrientedBoundingBox>();

  public override addOrUpdateParentBound(ref: unknown, orientedBox: OrientedBoundingBox): void {
    super.addOrUpdateParentBound(ref, orientedBox);
    this.applyBounds();
  }

  public override removeParentBound(ref: unknown): void {
    this.originalParentBounds.delete(ref);
    super.removeParentBound(ref);
    this.applyBounds();
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

  private applyBounds() {
    const appliedBounds = this.getAppliedBounds();
    if (appliedBounds.size > 0) {
      const thisElementBounds = this.getContentBounds();
      if (thisElementBounds) {
        let isVisible = true;
        for (const [ref, orientedBox] of this.getAppliedBounds()) {
          // If the parent bound does not completely contain the element bounds then console.log
          if (!OBBcontainsOBB(orientedBox, thisElementBounds)) {
            isVisible = false;
            this.container.visible = false;
            break;
          }
        }
        if (isVisible) {
          this.container.visible = true;
        }
      }
    }
  }

  protected override didUpdateTransformation() {
    this.applyBounds();
    super.didUpdateTransformation();
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    TransformableElement.TransformableElementAttributeHandler.handle(this, name, newValue);
    this.debugHelper.handle(name, newValue);
  }
}
