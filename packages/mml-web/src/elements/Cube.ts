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
const defaultCubeOpacity = 1;
const defaultCubeCastShadows = true;

export class Cube extends TransformableElement {
  static tagName = "m-cube";

  static boxGeometry = new THREE.BoxGeometry(1, 1, 1);

  private props = {
    width: defaultCubeWidth,
    height: defaultCubeHeight,
    depth: defaultCubeDepth,
    color: defaultCubeColor,
    opacity: defaultCubeOpacity,
    castShadows: defaultCubeCastShadows,
  };
  private mesh: THREE.Mesh<THREE.BoxGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial | null = null;
  private collideableHelper = new CollideableHelper(this);

  private static attributeHandler = new AttributeHandler<Cube>({
    width: (instance, newValue) => {
      instance.props.width = parseFloatAttribute(newValue, defaultCubeWidth);
      instance.mesh.scale.x = instance.props.width;
      instance.collideableHelper.updateCollider(instance.mesh);
    },
    height: (instance, newValue) => {
      instance.props.height = parseFloatAttribute(newValue, defaultCubeHeight);
      instance.mesh.scale.y = instance.props.height;
      instance.collideableHelper.updateCollider(instance.mesh);
    },
    depth: (instance, newValue) => {
      instance.props.depth = parseFloatAttribute(newValue, defaultCubeDepth);
      instance.mesh.scale.z = instance.props.depth;
      instance.collideableHelper.updateCollider(instance.mesh);
    },
    color: (instance, newValue) => {
      instance.props.color = parseColorAttribute(newValue, defaultCubeColor);
      if (instance.material) {
        instance.material.color = instance.props.color;
      }
    },
    opacity: (instance, newValue) => {
      instance.props.opacity = parseFloatAttribute(newValue, defaultCubeOpacity);
      if (instance.material) {
        instance.material.transparent = instance.props.opacity === 1 ? false : true;
        instance.material.opacity = parseFloatAttribute(newValue, 1);
      }
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultCubeCastShadows);
      instance.mesh.castShadow = instance.props.castShadows;
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Cube.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  constructor() {
    super();
    this.mesh = new THREE.Mesh(Cube.boxGeometry);
    this.mesh.scale.x = this.props.width;
    this.mesh.scale.y = this.props.height;
    this.mesh.scale.z = this.props.depth;
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

  public getCube(): THREE.Mesh<THREE.BoxGeometry, THREE.Material | Array<THREE.Material>> | null {
    return this.mesh;
  }

  public attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Cube.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this.material = new THREE.MeshStandardMaterial({
      color: this.props.color,
      transparent: this.props.opacity === 1 ? false : true,
      opacity: this.props.opacity,
    });
    this.mesh.material = this.material;
    this.collideableHelper.updateCollider(this.mesh);
  }

  public disconnectedCallback(): void {
    this.collideableHelper.removeColliders();
    if (this.material) {
      this.material.dispose();
      this.mesh.material = [];
      this.material = null;
    }
    super.disconnectedCallback();
  }
}
