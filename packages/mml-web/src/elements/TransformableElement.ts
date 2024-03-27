import * as THREE from "three";
import { OBB } from "three/examples/jsm/math/OBB.js";

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

// Workaround for zero-scale values breaking audio playback in THREE PositionalAudio
function minimumNonZero(value: number): number {
  return value === 0 ? 0.000001 : value;
}

const xAxis = new THREE.Vector3();
const yAxis = new THREE.Vector3();
const zAxis = new THREE.Vector3();

function OBBcontainsOBB(containingOBB: OBB, childOBB: OBB) {
  console.log("OBBcontainsOBB. containing: ", containingOBB, "child:", childOBB);

  // const isIntersecting = childOBB.intersectsOBB(containingOBB);
  // console.log("isIntersecting", isIntersecting);
  // return !isIntersecting;
  // we check if all eight points of obb2 are inside obb1
  // first, we calculate the eight points of obb2
  const points: Array<THREE.Vector3> = [];
  const sizeHalf = childOBB.halfSize;
  // Make a matrix4 from the childOBB's Matrix3 (rotation)
  // childOBB.rotation.extractBasis(xAxis, yAxis, zAxis);

  // const matrix = new THREE.Matrix4();
  // matrix.makeBasis(xAxis, yAxis, zAxis);
  // matrix.setPosition(childOBB.center);

  // Populate the points array with the 8 corners of the childOBB
  for (let x = -1; x <= 1; x += 2) {
    for (let y = -1; y <= 1; y += 2) {
      for (let z = -1; z <= 1; z += 2) {
        points.push(new THREE.Vector3(x * sizeHalf.x, y * sizeHalf.y, z * sizeHalf.z));
      }
    }
  }
  console.log("points", points);

  // then we check if all of these points are inside obb1
  return points.every((point) => containingOBB.containsPoint(point));
}

export abstract class TransformableElement extends MElement {
  private socketName: string | null = null;

  private TEMPDEBUGCONTAINER = new THREE.Group();

  connectedCallback(): void {
    super.connectedCallback();
    if (this.socketName !== null) {
      this.registerWithParentModel(this.socketName);
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

  constructor() {
    super();
    this.container.add(this.TEMPDEBUGCONTAINER);
  }

  protected abstract getContentBounds(): OBB | null;

  private originalParentBounds = new Map<unknown, OBB>();

  public override addOrUpdateParentBound(ref: unknown, orientedBox: OBB): void {
    console.log("addOrUpdateParentBound", this);
    this.originalParentBounds.set(ref, orientedBox.clone());
    const clonedOBB = orientedBox.clone();
    this.container.updateMatrix();
    const inverted = this.container.matrix.clone().invert();

    super.addOrUpdateParentBound(ref, clonedOBB);

    console.log(
      this.tagName,
      "cloned.rotation.before",
      JSON.stringify(clonedOBB.rotation.elements),
    );
    console.log(this.tagName, "inverted.elements", JSON.stringify(inverted.elements));
    clonedOBB.applyMatrix4(inverted);
    console.log(this.tagName, "cloned.rotation.after", JSON.stringify(clonedOBB.rotation.elements));

    this.TEMPDEBUGREDRAWBOUNDS();

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
    const thisElementBounds = this.getContentBounds();
    if (thisElementBounds) {
      for (const [ref, orientedBox] of this.getAppliedBounds()) {
        console.log(this.tagName, "thisElementBounds on apply", thisElementBounds);
        // If the parent bound does not completely contain the element bounds then console.log
        if (!OBBcontainsOBB(orientedBox, thisElementBounds)) {
          console.error("Parent bound does not completely contain element bounds", this);
          this.container.visible = false;
        } else {
          this.container.visible = true;
        }
      }
    }
  }

  private transformableAttributeChangedValue() {
    this.parentTransformed();
    traverseChildren(this, (child) => {
      if (child instanceof MElement) {
        child.parentTransformed();
      }
    });

    this.container.updateMatrix();
    const inverted = this.container.matrix.clone().invert();

    this.originalParentBounds.forEach((orientedBox, ref) => {
      const cloned = orientedBox.clone();
      console.log("Modifying original parent bounds");
      console.log(this.tagName, "cloned.rotation.before", JSON.stringify(cloned.rotation.elements));
      console.log(this.tagName, "inverted.elements", JSON.stringify(inverted.elements));
      cloned.applyMatrix4(inverted);
      console.log(this.tagName, "cloned.rotation.after", JSON.stringify(cloned.rotation.elements));
      super.addOrUpdateParentBound(ref, cloned);
    });

    this.TEMPDEBUGREDRAWBOUNDS();

    this.applyBounds();
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    TransformableElement.TransformableElementAttributeHandler.handle(this, name, newValue);
    this.debugHelper.handle(name, newValue);
  }

  private TEMPDEBUGREDRAWBOUNDS() {
    if (this.tagName === "M-FRAME") {
      return;
    }
    this.TEMPDEBUGCONTAINER.clear();

    const inverted = this.container.matrix.clone().invert();
    for (const [ref, orientedBox] of this.originalParentBounds) {
      console.log("TEMPDEBUGREDRAWzBOUNDS", orientedBox);
      const scale = new THREE.Vector3();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      inverted.decompose(position, quaternion, scale);

      const geometry = new THREE.BoxGeometry(
        orientedBox.halfSize.x * 2,
        orientedBox.halfSize.y * 2,
        orientedBox.halfSize.z * 2,
        2,2,2,
      );
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
      const cube = new THREE.Mesh(geometry, material);
      // cube.position.copy(orientedBox.center);
      // const matrix = new THREE.Matrix4();
      // matrix.setFromMatrix3(orientedBox.rotation);
      // cube.applyMatrix4(matrix);

      cube.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(), new THREE.Quaternion(), scale));
      cube.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(), quaternion, new THREE.Vector3(1,1,1)));
      cube.applyMatrix4(new THREE.Matrix4().compose(position, new THREE.Quaternion(), new THREE.Vector3(1,1,1)));
      // cube.applyMatrix4(inverted);

      this.TEMPDEBUGCONTAINER.add(cube);
    }
  }
}

function traverseChildren(element: ChildNode, callback: (element: ChildNode) => void) {
  element.childNodes.forEach((child) => {
    callback(child);
    traverseChildren(child, callback);
  });
}
