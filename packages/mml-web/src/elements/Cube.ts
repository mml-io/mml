import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";

const defaultCubeColor = new THREE.Color(0xffffff);
const defaultCubeWidth = 1;
const defaultCubeHeight = 1;
const defaultCubeDepth = 1;

export class Cube extends TransformableElement {
  static tagName = "m-cube";
  private static attributeHandler = new AttributeHandler<Cube>({
    width: (instance, newValue) => {
      instance.mesh.scale.x = parseFloatAttribute(newValue, defaultCubeWidth);
      instance.collideableHelper.updateCollider(instance.mesh);
    },
    height: (instance, newValue) => {
      instance.mesh.scale.y = parseFloatAttribute(newValue, defaultCubeHeight);
      instance.collideableHelper.updateCollider(instance.mesh);
    },
    depth: (instance, newValue) => {
      instance.mesh.scale.z = parseFloatAttribute(newValue, defaultCubeDepth);
      instance.collideableHelper.updateCollider(instance.mesh);
    },
    color: (instance, newValue) => {
      const color = parseColorAttribute(newValue, defaultCubeColor);
      instance.mesh.material.color = color;
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
      ...Cube.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }


  private collideableHelper = new CollideableHelper(this);

  constructor() {
    super();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: defaultCubeColor, transparent: true });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.scale.x = defaultCubeWidth;
    this.mesh.scale.y = defaultCubeHeight;
    this.mesh.scale.z = defaultCubeDepth;
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

  public getCube(): THREE.Mesh<
    THREE.BoxGeometry,
    THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  > {
    return this.mesh;
  }

  public attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Cube.attributeHandler.handle(this, name, newValue);
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
