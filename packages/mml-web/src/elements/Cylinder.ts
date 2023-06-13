import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import {
  AttributeHandler,
  parseColorAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";

const defaultButtonColor = new THREE.Color(0xffffff);
const defaultButtonRadius = 0.5;
const defaultButtonHeight = 1;

export class Cylinder extends TransformableElement {
  static tagName = "m-cylinder";

  private props = {
    radius: defaultButtonRadius as number,
    height: defaultButtonHeight as number,
  };

  private static attributeHandler = new AttributeHandler<Cylinder>({
    height: (instance, newValue) => {
      instance.props.height = parseFloatAttribute(newValue, defaultButtonHeight);
      instance.mesh.scale.set(
        instance.props.radius * 2,
        instance.props.height,
        instance.props.radius * 2,
      );
      instance.collideableHelper.updateCollider(instance.mesh);
    },
    radius: (instance, newValue) => {
      instance.props.radius = parseFloatAttribute(newValue, defaultButtonRadius);
      instance.mesh.scale.set(
        instance.props.radius * 2,
        instance.props.height,
        instance.props.radius * 2,
      );
      instance.collideableHelper.updateCollider(instance.mesh);
    },
    color: (instance, newValue) => {
      const color = parseColorAttribute(newValue, defaultButtonColor);
      instance.mesh.material.color = color;
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Cylinder.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  private mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  private collideableHelper = new CollideableHelper(this);

  constructor() {
    super();
    const geometry = new THREE.CylinderGeometry(
      defaultButtonRadius,
      defaultButtonRadius,
      defaultButtonHeight,
    );
    const material = new THREE.MeshStandardMaterial({ color: defaultButtonColor });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.container.add(this.mesh);
  }

  connectedCallback() {
    super.connectedCallback();
    this.collideableHelper.updateCollider(this.mesh);
  }

  disconnectedCallback() {
    this.collideableHelper.removeColliders();
    super.disconnectedCallback();
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  public getCylinder(): THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial> {
    return this.mesh;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Cylinder.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }
}
