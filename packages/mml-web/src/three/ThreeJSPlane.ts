import * as THREE from "three";

import { MPlaneProps, Plane } from "../elements";
import { MMLColor, PlaneGraphics } from "../MMLGraphicsInterface";

export class ThreeJSPlane extends PlaneGraphics {
  static planeGeometry = new THREE.PlaneGeometry(1, 1);
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial;

  constructor(private plane: Plane) {
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

  setColor(color: MMLColor, mPlaneProps: MPlaneProps): void {
    this.material.color = new THREE.Color(color.r, color.g, color.b);
  }

  setWidth(width: number, mPlaneProps: MPlaneProps): void {
    this.mesh.scale.x = width;
  }

  setHeight(height: number, mPlaneProps: MPlaneProps): void {
    this.mesh.scale.y = height;
  }

  setCastShadows(castShadows: boolean, mPlaneProps: MPlaneProps): void {
    this.mesh.castShadow = castShadows;
  }

  setOpacity(opacity: number, mPlaneProps: MPlaneProps): void {
    const needsUpdate = this.material.transparent === (opacity === 1);
    this.material.transparent = opacity !== 1;
    this.material.needsUpdate = needsUpdate;
    this.material.opacity = opacity;
  }

  dispose() {}
}
