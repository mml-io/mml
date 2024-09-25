import { Plane } from "mml-web";
import { MMLColor } from "mml-web";
import { PlaneGraphics } from "mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export class ThreeJSPlane extends PlaneGraphics<ThreeJSGraphicsAdapter> {
  static planeGeometry = new THREE.PlaneGeometry(1, 1);
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial;

  constructor(private plane: Plane<ThreeJSGraphicsAdapter>) {
    super(plane);

    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(plane.props.color.r, plane.props.color.g, plane.props.color.b),
    });
    this.mesh = new THREE.Mesh(ThreeJSPlane.planeGeometry, this.material);
    this.mesh.castShadow = plane.props.castShadows;
    this.mesh.receiveShadow = true;
    this.plane.getContainer().add(this.mesh);
  }

  disable(): void {}

  enable(): void {}

  getCollisionElement(): THREE.Object3D {
    return this.mesh;
  }

  setColor(color: MMLColor): void {
    this.material.color = new THREE.Color(color.r, color.g, color.b);
  }

  setWidth(width: number): void {
    this.mesh.scale.x = width;
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
