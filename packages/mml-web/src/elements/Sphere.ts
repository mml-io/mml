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

const defaultSphereColor = new THREE.Color(0xffffff);
const defaultSphereRadius = 0.5;
const defaultSphereOpacity = 1;
const defaultSphereCastShadows = true;

const defaultSphereWidthSegments = 16;
const defaultSphereHeightSegments = 16;

export class Sphere extends TransformableElement {
  static tagName = "m-sphere";

  private sphereAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    color: [
      AnimationType.Color,
      defaultSphereColor,
      (newValue: THREE.Color) => {
        this.props.color = newValue;
        if (this.material) {
          this.material.color = this.props.color;
        }
      },
    ],
    radius: [
      AnimationType.Number,
      defaultSphereRadius,
      (newValue: number) => {
        this.props.radius = newValue;
        const scale = this.props.radius * 2;
        this.mesh.scale.set(scale, scale, scale);
        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    opacity: [
      AnimationType.Number,
      defaultSphereOpacity,
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

  static sphereGeometry = new THREE.SphereGeometry(
    defaultSphereRadius,
    defaultSphereWidthSegments,
    defaultSphereHeightSegments,
  );

  private props = {
    radius: defaultSphereRadius as number,
    color: defaultSphereColor,
    opacity: defaultSphereOpacity,
    castShadows: defaultSphereCastShadows,
  };

  private mesh: THREE.Mesh<THREE.SphereGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial | null = null;

  private collideableHelper = new CollideableHelper(this);

  private static attributeHandler = new AttributeHandler<Sphere>({
    color: (instance, newValue) => {
      instance.sphereAnimatedAttributeHelper.elementSetAttribute(
        "color",
        parseColorAttribute(newValue, defaultSphereColor),
      );
    },
    radius: (instance, newValue) => {
      instance.sphereAnimatedAttributeHelper.elementSetAttribute(
        "radius",
        parseFloatAttribute(newValue, defaultSphereRadius),
      );
    },
    opacity: (instance, newValue) => {
      instance.sphereAnimatedAttributeHelper.elementSetAttribute(
        "opacity",
        parseFloatAttribute(newValue, defaultSphereOpacity),
      );
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultSphereCastShadows);
      instance.mesh.castShadow = instance.props.castShadows;
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Sphere.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  constructor() {
    super();
    this.mesh = new THREE.Mesh(Sphere.sphereGeometry);
    this.mesh.scale.x = this.props.radius * 2;
    this.mesh.scale.y = this.props.radius * 2;
    this.mesh.scale.z = this.props.radius * 2;
    this.mesh.castShadow = this.props.castShadows;
    this.mesh.receiveShadow = true;
    this.container.add(this.mesh);
  }

  protected enable() {
    this.collideableHelper.enable();
  }

  protected disable() {
    this.collideableHelper.disable();
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromSizeAndMatrixWorldProvider(
      new THREE.Vector3(this.props.radius * 2, this.props.radius * 2, this.props.radius * 2),
      this.container,
    );
  }

  public addSideEffectChild(child: MElement): void {
    this.sphereAnimatedAttributeHelper.addSideEffectChild(child);

    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    this.sphereAnimatedAttributeHelper.removeSideEffectChild(child);

    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  public getSphere(): THREE.Mesh<
    THREE.SphereGeometry,
    THREE.Material | Array<THREE.Material>
  > | null {
    return this.mesh;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Sphere.attributeHandler.handle(this, name, newValue);
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
}
