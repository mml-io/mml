


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


      ...Sphere.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,







  private collideableHelper = new CollideableHelper(this);



    const geometry = new THREE.SphereGeometry(
      defaultSphereRadius,
      defaultWidthSegments,
      defaultHeightSegments,
    );
    const material = new THREE.MeshStandardMaterial({
      color: defaultSphereColor,
      transparent: true,
    });






  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }





  public getSphere(): THREE.Mesh<
    THREE.SphereGeometry,
    THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  > {





    Sphere.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);




    this.collideableHelper.updateCollider(this.mesh);



    this.collideableHelper.removeColliders();



