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
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

const defaultCylinderColor = new THREE.Color(0xffffff);
const defaultCylinderRadius = 0.5;
const defaultCylinderHeight = 1;
const defaultCylinderOpacity = 1;
const defaultCylinderCastShadows = true;

export class Cylinder extends TransformableElement {
  static tagName = "m-cylinder";

  private cylinderAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    color: [
      AnimationType.Color,
      defaultCylinderColor,
      (newValue: THREE.Color) => {
        this.props.color = newValue;
        if (this.material) {
          this.material.color = this.props.color;
        }
      },
    ],
    radius: [
      AnimationType.Number,
      defaultCylinderRadius,
      (newValue: number) => {
        this.props.radius = newValue;
        this.mesh.scale.set(this.props.radius * 2, this.props.height, this.props.radius * 2);
        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    height: [
      AnimationType.Number,
      defaultCylinderHeight,
      (newValue: number) => {
        this.props.height = newValue;
        this.mesh.scale.y = this.props.height;
        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    opacity: [
      AnimationType.Number,
      defaultCylinderOpacity,
      (newValue: number) => {
        this.props.opacity = newValue;
        if (this.material) {
          const needsUpdate = this.material.transparent === (this.props.opacity === 1);
          this.material.transparent = this.props.opacity !== 1;
          this.material.needsUpdate = needsUpdate;
          this.material.opacity = newValue;
        }
      },
    ],
  });

  static cylinderGeometry = new THREE.CylinderGeometry(
    defaultCylinderRadius,
    defaultCylinderRadius,
    defaultCylinderHeight,
  );

  private props = {
    radius: defaultCylinderRadius as number,
    height: defaultCylinderHeight as number,
    color: defaultCylinderColor,
    opacity: defaultCylinderOpacity,
    castShadows: defaultCylinderCastShadows,
  };

  private mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial | null = null;

  private collideableHelper = new CollideableHelper(this);

  private static attributeHandler = new AttributeHandler<Cylinder>({
    height: (instance, newValue) => {
      instance.cylinderAnimatedAttributeHelper.elementSetAttribute(
        "height",
        parseFloatAttribute(newValue, defaultCylinderHeight),
      );
    },
    radius: (instance, newValue) => {
      instance.cylinderAnimatedAttributeHelper.elementSetAttribute(
        "radius",
        parseFloatAttribute(newValue, defaultCylinderRadius),
      );
    },
    color: (instance, newValue) => {
      instance.cylinderAnimatedAttributeHelper.elementSetAttribute(
        "color",
        parseColorAttribute(newValue, defaultCylinderColor),
      );
    },
    opacity: (instance, newValue) => {
      instance.cylinderAnimatedAttributeHelper.elementSetAttribute(
        "opacity",
        parseFloatAttribute(newValue, defaultCylinderOpacity),
      );
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultCylinderCastShadows);
      instance.mesh.castShadow = instance.props.castShadows;
    },
  });

  protected enable() {
    this.collideableHelper.enable();
  }

  protected disable() {
    this.collideableHelper.disable();
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Cylinder.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  constructor() {
    super();

    this.mesh = new THREE.Mesh(Cylinder.cylinderGeometry);
    this.mesh.scale.x = this.props.radius * 2;
    this.mesh.scale.y = this.props.height;
    this.mesh.scale.z = this.props.radius * 2;
    this.mesh.castShadow = this.props.castShadows;
    this.mesh.receiveShadow = true;
    this.container.add(this.mesh);
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromSizeAndMatrixWorldProvider(
      new THREE.Vector3(this.props.radius * 2, this.props.height, this.props.radius * 2),
      this.container,
    );
  }

  public addSideEffectChild(child: MElement): void {
    this.cylinderAnimatedAttributeHelper.addSideEffectChild(child);

    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    this.cylinderAnimatedAttributeHelper.removeSideEffectChild(child);

    super.removeSideEffectChild(child);
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Cylinder.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  connectedCallback() {
    super.connectedCallback();
    this.material = new THREE.MeshStandardMaterial({
      color: this.props.color,
      transparent: this.props.opacity === 1 ? false : true,
      opacity: this.props.opacity,
    });
    this.mesh.material = this.material;
    this.applyBounds();
    this.collideableHelper.updateCollider(this.mesh);
  }

  disconnectedCallback() {
    this.collideableHelper.removeColliders();
    if (this.material) {
      this.material.dispose();
      this.mesh.material = [];
      this.material = null;
    }
    super.disconnectedCallback();
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  public getCylinder(): THREE.Mesh<
    THREE.CylinderGeometry,
    THREE.Material | Array<THREE.Material>
  > | null {
    return this.mesh;
  }
}
