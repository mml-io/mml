import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";

const defaultPlaneColor = new THREE.Color(0xffffff);
const defaultPlaneWidth = 1;
const defaultPlaneHeight = 1;

export class Plane extends TransformableElement {
  static tagName = "m-plane";
  private static attributeHandler = new AttributeHandler<Plane>({
    width: (instance, newValue) => {
      instance.mesh.scale.x = parseFloatAttribute(newValue, defaultPlaneWidth);
      instance.collideableHelper.updateCollider(instance.mesh);
    },
    height: (instance, newValue) => {
      instance.mesh.scale.y = parseFloatAttribute(newValue, defaultPlaneHeight);
      instance.collideableHelper.updateCollider(instance.mesh);
    },
    color: (instance, newValue) => {
      const color = parseColorAttribute(newValue, defaultPlaneColor);
      instance.mesh.material.color = color;
    },
    "cast-shadows": (instance, newValue) => {
      instance.mesh.castShadow = parseBoolAttribute(newValue, true);
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Plane.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }
  private collideableHelper = new CollideableHelper(this);
  private mesh: THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  >;

  constructor() {
    super();
    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
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

  public getPlane(): THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  > {
    return this.mesh;
  }

  public attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Plane.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this.collideableHelper.updateCollider(this.mesh);
  }

  public disconnectedCallback(): void {
    this.collideableHelper.removeColliders();
    super.disconnectedCallback();
  }
}
