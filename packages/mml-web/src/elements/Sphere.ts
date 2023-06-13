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
const defaultWidthSegments = 16;
const defaultHeightSegments = 16;

export class Sphere extends TransformableElement {
  static tagName = "m-sphere";

  private static attributeHandler = new AttributeHandler<Sphere>({
    color: (instance, newValue) => {
      const color = parseColorAttribute(newValue, defaultSphereColor);
      instance.mesh.material.color = color;
    },
    radius: (instance, newValue) => {
      const scale = parseFloatAttribute(newValue, defaultSphereRadius) * 2;
      instance.mesh.scale.set(scale, scale, scale);
    },
    opacity: (instance, newValue) => {
      instance.mesh.material.opacity = parseFloatAttribute(newValue, 1);
    },
    "cast-shadows": (instance, newValue) => {
      instance.mesh.castShadow = parseBoolAttribute(newValue, true);
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Sphere.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  private mesh: THREE.Mesh<
    THREE.SphereGeometry,
    THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  >;
  private collideableHelper = new CollideableHelper(this);

  constructor() {
    super();
    const geometry = new THREE.SphereGeometry(
      defaultSphereRadius,
      defaultWidthSegments,
      defaultHeightSegments,
    );
    const material = new THREE.MeshStandardMaterial({
      color: defaultSphereColor,
      transparent: true,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
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
    THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  > {
    return this.mesh;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Sphere.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.collideableHelper.updateCollider(this.mesh);
  }

  disconnectedCallback(): void {
    this.collideableHelper.removeColliders();
    super.disconnectedCallback();
  }
}
