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
const defaultPlaneOpacity = 1;
const defaultPlaneCastShadows = true;

export class Plane extends TransformableElement {
  static tagName = "m-plane";

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

  private static attributeHandler = new AttributeHandler<Plane>({
    width: (instance, newValue) => {
      instance.props.width = parseFloatAttribute(newValue, defaultPlaneWidth);
      instance.mesh.scale.x = instance.props.width;
      instance.collideableHelper.updateCollider(instance.mesh);
    },
    height: (instance, newValue) => {
      instance.props.height = parseFloatAttribute(newValue, defaultPlaneHeight);
      instance.mesh.scale.y = instance.props.height;
      instance.collideableHelper.updateCollider(instance.mesh);
    },
    color: (instance, newValue) => {
      instance.props.color = parseColorAttribute(newValue, defaultPlaneColor);
      if (instance.material) {
        instance.material.color = instance.props.color;
      }
    },
    opacity: (instance, newValue) => {
      instance.props.opacity = parseFloatAttribute(newValue, defaultPlaneOpacity);
      if (instance.material) {
        instance.material.transparent = instance.props.opacity === 1 ? false : true;
        instance.material.opacity = parseFloatAttribute(newValue, 1);
      }
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
