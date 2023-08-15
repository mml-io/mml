import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";

const defaultSphereColor = new THREE.Color(0xffffff);
const defaultSphereRadius = 0.5;
const defaultSphereOpacity = 1;
const defaultSphereCastShadows = true;

const defaultSphereWidthSegments = 16;
const defaultSphereHeightSegments = 16;

export class Sphere extends TransformableElement {
  static tagName = "m-sphere";

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
      instance.props.color = parseColorAttribute(newValue, defaultSphereColor);
      if (instance.material) {
        instance.material.color = instance.props.color;
      }
    },
    radius: (instance, newValue) => {
      instance.props.radius = parseFloatAttribute(newValue, defaultSphereRadius);
      const scale = instance.props.radius * 2;
      instance.mesh.scale.set(scale, scale, scale);
      instance.collideableHelper.updateCollider(instance.mesh);
    },
    opacity: (instance, newValue) => {
      instance.props.opacity = parseFloatAttribute(newValue, defaultSphereOpacity);
      if (instance.material) {
        const needsUpdate = instance.material.transparent === (instance.props.opacity === 1);
        instance.material.transparent = instance.props.opacity !== 1;
        instance.material.needsUpdate = needsUpdate;
        instance.material.opacity = parseFloatAttribute(newValue, 1);
      }
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
