import * as THREE from "three";

import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";
import { MaterialElementHelper } from "../utils/MaterialHelper";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

const defaultPlaneColor = new THREE.Color(0xffffff);
const defaultPlaneWidth = 1;
const defaultPlaneHeight = 1;
const defaultPlaneOpacity = 1;
const defaultPlaneCastShadows = true;

export class Plane extends TransformableElement {
  static tagName = "m-plane";

  private planeAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    color: [
      AnimationType.Color,
      defaultPlaneColor,
      (newValue: THREE.Color) => {
        this.props.color = newValue;
        if (this.material && !this.materialHelper.registeredChildMaterial) {
          this.material.color = this.props.color;
        }
      },
    ],
    width: [
      AnimationType.Number,
      defaultPlaneWidth,
      (newValue: number) => {
        this.props.width = newValue;
        this.mesh.scale.x = this.props.width;
        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    height: [
      AnimationType.Number,
      defaultPlaneHeight,
      (newValue: number) => {
        this.props.height = newValue;
        this.mesh.scale.y = this.props.height;
        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    opacity: [
      AnimationType.Number,
      defaultPlaneOpacity,
      (newValue: number) => {
        this.props.opacity = newValue;
        if (this.material && !this.materialHelper.registeredChildMaterial) {
          const needsUpdate = this.material.transparent === (this.props.opacity === 1);
          this.material.transparent = this.props.opacity !== 1;
          this.material.needsUpdate = needsUpdate;
          this.material.opacity = newValue;
        }
      },
    ],
  });

  private static planeGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);

  private props = {
    width: defaultPlaneWidth,
    height: defaultPlaneHeight,
    color: defaultPlaneColor,
    opacity: defaultPlaneOpacity,
    castShadows: defaultPlaneCastShadows,
  };
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial | null = null;
  private collideableHelper = new CollideableHelper(this);
  private materialHelper = new MaterialElementHelper(this);

  private static attributeHandler = new AttributeHandler<Plane>({
    width: (instance, newValue) => {
      instance.planeAnimatedAttributeHelper.elementSetAttribute(
        "width",
        parseFloatAttribute(newValue, defaultPlaneWidth),
      );
    },
    height: (instance, newValue) => {
      instance.planeAnimatedAttributeHelper.elementSetAttribute(
        "height",
        parseFloatAttribute(newValue, defaultPlaneHeight),
      );
    },
    color: (instance, newValue) => {
      instance.planeAnimatedAttributeHelper.elementSetAttribute(
        "color",
        parseColorAttribute(newValue, defaultPlaneColor),
      );
    },
    opacity: (instance, newValue) => {
      instance.planeAnimatedAttributeHelper.elementSetAttribute(
        "opacity",
        parseFloatAttribute(newValue, defaultPlaneOpacity),
      );
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultPlaneCastShadows);
      instance.mesh.castShadow = instance.props.castShadows;
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Plane.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
      ...MaterialElementHelper.observedAttributes,
    ];
  }

  constructor() {
    super();

    this.mesh = new THREE.Mesh(Plane.planeGeometry);
    this.mesh.scale.x = this.props.width;
    this.mesh.scale.y = this.props.height;
    this.mesh.castShadow = this.props.castShadows;
    this.mesh.receiveShadow = true;
    this.container.add(this.mesh);
  }

  protected enable() {
    this.collideableHelper.enable();
    this.materialHelper.enable();
  }

  protected disable() {
    this.collideableHelper.disable();
    this.materialHelper.disable();
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromSizeAndMatrixWorldProvider(
      new THREE.Vector3(this.props.width, this.props.height, 0),
      this.container,
    );
  }

  public addSideEffectChild(child: MElement): void {
    this.planeAnimatedAttributeHelper.addSideEffectChild(child);
    this.materialHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    this.planeAnimatedAttributeHelper.removeSideEffectChild(child);
    this.materialHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  public getPlane(): THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.Material | Array<THREE.Material>
  > | null {
    return this.mesh;
  }

  public attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Plane.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
    this.materialHelper.handle(name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this.materialHelper.connectedCallback();
    if (!this.materialHelper.registeredChildMaterial) {
      this.material = this.getDefaultMaterial();
      this.mesh.material = this.material;
    }

    this.applyBounds();
    this.collideableHelper.updateCollider(this.mesh);
  }

  public disconnectedCallback(): void {
    this.materialHelper.disconnectedCallback();
    this.collideableHelper.removeColliders();

    if (!this.materialHelper.registeredChildMaterial) {
      this.material?.dispose();
    }

    if (this.material) {
      this.mesh.material = [];
      this.material = null;
    }
    super.disconnectedCallback();
  }

  public getDefaultMaterial() {
    return new THREE.MeshStandardMaterial({
      color: this.props.color,
      transparent: this.props.opacity === 1 ? false : true,
      opacity: this.props.opacity,
    });
  }

  public setMaterial(material: THREE.MeshStandardMaterial) {
    if (this.material) {
      this.material.dispose();
    }
    this.material = material;
    this.mesh.material = this.material;
  }
}
