import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";

const defaultCylinderColor = new THREE.Color(0xffffff);
const defaultCylinderRadius = 0.5;
const defaultCylinderHeight = 1;
const defaultCylinderOpacity = 1;
const defaultCylinderCastShadows = true;

export class Cylinder extends TransformableElement {
  static tagName = "m-cylinder";

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
      instance.props.height = parseFloatAttribute(newValue, defaultCylinderHeight);
      instance.mesh.scale.set(
        instance.props.radius * 2,
        instance.props.height,
        instance.props.radius * 2,
      );
      instance.collideableHelper.updateCollider(instance.mesh);
    },
    radius: (instance, newValue) => {
      instance.props.radius = parseFloatAttribute(newValue, defaultCylinderRadius);
      instance.mesh.scale.set(
        instance.props.radius * 2,
        instance.props.height,
        instance.props.radius * 2,
      );
      instance.collideableHelper.updateCollider(instance.mesh);
    },
    color: (instance, newValue) => {
      instance.props.color = parseColorAttribute(newValue, defaultCylinderColor);
      if (instance.material) {
        instance.material.color = instance.props.color;
      }
    },
    opacity: (instance, newValue) => {
      instance.props.opacity = parseFloatAttribute(newValue, defaultCylinderOpacity);
      if (instance.material) {
        instance.material.opacity = parseFloatAttribute(newValue, 1);
      }
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultCylinderCastShadows);
      instance.mesh.castShadow = instance.props.castShadows;
    },
  });

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

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Cylinder.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  connectedCallback() {
    super.connectedCallback();
    this.material = new THREE.MeshStandardMaterial({
      color: this.props.color,
      transparent: true,
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
