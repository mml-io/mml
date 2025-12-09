import { Cylinder, CylinderGraphics, MMLColor } from "@mml-io/mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export class ThreeJSCylinder extends CylinderGraphics<ThreeJSGraphicsAdapter> {
  static cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1);
  private mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial;

  constructor(private cylinder: Cylinder<ThreeJSGraphicsAdapter>) {
    super(cylinder);

    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(
        cylinder.props.color.r,
        cylinder.props.color.g,
        cylinder.props.color.b,
      ),
    });
    this.mesh = new THREE.Mesh(ThreeJSCylinder.cylinderGeometry, this.material);
    this.mesh.castShadow = cylinder.props.castShadows;
    this.mesh.receiveShadow = true;
    this.cylinder.getContainer().add(this.mesh);
  }

  disable(): void {}

  enable(): void {}

  getCollisionElement(): THREE.Object3D {
    return this.mesh;
  }

  setColor(color: MMLColor): void {
    this.material.color = new THREE.Color(color.r, color.g, color.b);
  }

  setRadius(radius: number): void {
    this.mesh.scale.x = radius * 2;
    this.mesh.scale.z = radius * 2;
  }

  setHeight(height: number): void {
    this.mesh.scale.y = height;
  }

  setCastShadows(castShadows: boolean): void {
    this.mesh.castShadow = castShadows;
  }

  setOpacity(opacity: number): void {
    const needsUpdate = this.material.transparent === (opacity === 1);
    this.material.transparent = opacity !== 1;
    this.material.needsUpdate = needsUpdate;
    this.material.opacity = opacity;
  }

  dispose() {}
}
