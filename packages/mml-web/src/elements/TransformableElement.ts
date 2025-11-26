import { AnimatedAttributeHelper } from "../attribute-animation";
import { AttributeHandler, parseBoolAttribute, parseFloatAttribute } from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { DebugHelper } from "../debug-helper";
import { GraphicsAdapter, TransformableGraphics } from "../graphics";
import { degToRad, IVect3, Matr4, Quat, Vect3 } from "../math";
import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";

// Workaround for zero-scale values breaking audio playback in THREE PositionalAudio
function minimumNonZero(value: number): number {
  return value === 0 ? 0.000001 : value;
}

const defaultVisible = true;

export type TransformableElementProps = {
  socket: string | null;
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

export abstract class TransformableElement<
  G extends GraphicsAdapter = GraphicsAdapter,
> extends MElement<G> {
  public readonly isTransformableElement = true;

  private static tempQuat = new Quat();

  private transformableElementProps: TransformableElementProps = {
    socket: null,
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

  protected transformableElementGraphics: TransformableGraphics<G> | null = null;

  public static isTransformableElement(element: object): element is TransformableElement {
    return (element as TransformableElement).isTransformableElement;
  }

  private getTransformableElementParent(): TransformableElement<G> | null {
    let parentNode = this.parentNode;
    while (parentNode != null) {
      if (TransformableElement.isTransformableElement(parentNode)) {
        return parentNode as TransformableElement<G>;
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
      x: degToRad(this.transformableElementProps.rx),
      y: degToRad(this.transformableElementProps.ry),
      z: degToRad(this.transformableElementProps.rz),
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

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.transformableElementGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();

    this.transformableElementGraphics = graphicsAdapter
      .getGraphicsAdapterFactory()
      .MMLTransformableGraphicsInterface(this);

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
    this.transformableAnimatedAttributeHelper.reset();
    this.transformableElementGraphics?.dispose();
    this.debugHelper.dispose();
    this.transformableElementGraphics = null;
    super.disconnectedCallback();
  }

  private transformableAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
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
      AnimationType.Degrees,
      0,
      (newValue: number) => {
        this.transformableElementProps.rx = newValue;
        this.transformableElementGraphics?.setRotationX(newValue, this.transformableElementProps);
        this.didUpdateTransformation();
      },
    ],
    ry: [
      AnimationType.Degrees,
      0,
      (newValue: number) => {
        this.transformableElementProps.ry = newValue;
        this.transformableElementGraphics?.setRotationY(newValue, this.transformableElementProps);
        this.didUpdateTransformation();
      },
    ],
    rz: [
      AnimationType.Degrees,
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

  private static TransformableElementAttributeHandler = new AttributeHandler<
    TransformableElement<GraphicsAdapter>
  >({
    x: (instance, newValue) => {
      instance.transformableAnimatedAttributeHelper.elementSetAttribute(
        "x",
        parseFloatAttribute(newValue, 0),
      );
    },
    y: (instance, newValue) => {
      instance.transformableAnimatedAttributeHelper.elementSetAttribute(
        "y",
        parseFloatAttribute(newValue, 0),
      );
    },
    z: (instance, newValue) => {
      instance.transformableAnimatedAttributeHelper.elementSetAttribute(
        "z",
        parseFloatAttribute(newValue, 0),
      );
    },
    rx: (instance, newValue) => {
      instance.transformableAnimatedAttributeHelper.elementSetAttribute(
        "rx",
        parseFloatAttribute(newValue, 0),
      );
    },
    ry: (instance, newValue) => {
      instance.transformableAnimatedAttributeHelper.elementSetAttribute(
        "ry",
        parseFloatAttribute(newValue, 0),
      );
    },
    rz: (instance, newValue) => {
      instance.transformableAnimatedAttributeHelper.elementSetAttribute(
        "rz",
        parseFloatAttribute(newValue, 0),
      );
    },
    sx: (instance, newValue) => {
      instance.transformableAnimatedAttributeHelper.elementSetAttribute(
        "sx",
        parseFloatAttribute(newValue, 1),
      );
    },
    sy: (instance, newValue) => {
      instance.transformableAnimatedAttributeHelper.elementSetAttribute(
        "sy",
        parseFloatAttribute(newValue, 1),
      );
    },
    sz: (instance, newValue) => {
      instance.transformableAnimatedAttributeHelper.elementSetAttribute(
        "sz",
        parseFloatAttribute(newValue, 1),
      );
    },
    visible: (instance, newValue) => {
      instance.desiredVisible = parseBoolAttribute(newValue, defaultVisible);
      instance.updateVisibility();
    },
    socket: (instance, newValue) => {
      instance.transformableElementProps.socket = newValue;
      instance.transformableElementGraphics?.setSocket(
        newValue,
        instance.transformableElementProps,
      );
      instance.applyBounds();
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.TransformableElementAttributeHandler.getAttributes(),
      ...DebugHelper.observedAttributes,
    ];
  }

  private debugHelper = new DebugHelper(this);

  public abstract getContentBounds(): OrientedBoundingBox | null;

  public addSideEffectChild(child: MElement<G>): void {
    this.transformableAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.transformableAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  protected applyBounds() {
    if (!this.transformableElementGraphics) {
      // This element hasn't been connected yet - ignore the bounds application as it will be applied when connected
      return;
    }
    const appliedBounds = this.getAppliedBounds();
    if (appliedBounds.size > 0) {
      const thisElementBounds = this.getContentBounds();
      if (thisElementBounds) {
        for (const [, orientedBox] of appliedBounds) {
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

  public didUpdateTransformation() {
    this.applyBounds();
    this.parentTransformed();
    traverseImmediateTransformableElementChildren(this, (child) => {
      child.didUpdateTransformation();
    });
  }

  public attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.transformableElementGraphics) {
      return;
    }

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

  public isDisabled() {
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
    this.transformableElementGraphics?.setVisible(
      this.desiredVisible && !this.isDisabled(),
      this.transformableElementProps,
    );
  }

  public getVisible(): boolean {
    return this.transformableElementGraphics?.getVisible() ?? false;
  }

  public getWorldPosition(): IVect3 {
    return this.transformableElementGraphics?.getWorldPosition() ?? new Vect3(0, 0, 0);
  }

  public getLocalPosition(): IVect3 {
    return this.transformableElementGraphics?.getLocalPosition() ?? new Vect3(0, 0, 0);
  }
}

function traverseImmediateTransformableElementChildren<G extends GraphicsAdapter = GraphicsAdapter>(
  element: ChildNode,
  callback: (element: TransformableElement<G>) => void,
) {
  element.childNodes.forEach((child) => {
    if (TransformableElement.isTransformableElement(child)) {
      callback(child as TransformableElement<G>);
    } else {
      traverseImmediateTransformableElementChildren(child, callback);
    }
  });
}
