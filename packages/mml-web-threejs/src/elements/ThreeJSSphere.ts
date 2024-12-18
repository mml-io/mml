import { Sphere } from "@mml-io/mml-web";
import { MMLColor } from "@mml-io/mml-web";
import { SphereGraphics } from "@mml-io/mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

const defaultSphereWidthSegments = 16;
const defaultSphereHeightSegments = 16;

export class ThreeJSSphere extends SphereGraphics<ThreeJSGraphicsAdapter> {
  static sphereGeometry = new THREE.SphereGeometry(
    0.5,
    defaultSphereWidthSegments,
    defaultSphereHeightSegments,
  );
  private mesh: THREE.Mesh<THREE.SphereGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial;

  constructor(private sphere: Sphere<ThreeJSGraphicsAdapter>) {
    super(sphere);

    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(sphere.props.color.r, sphere.props.color.g, sphere.props.color.b),
    });
    this.mesh = new THREE.Mesh(ThreeJSSphere.sphereGeometry, this.material);
    this.mesh.castShadow = sphere.props.castShadows;
    this.mesh.receiveShadow = true;
    this.sphere.getContainer().add(this.mesh);
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
    this.mesh.scale.y = radius * 2;
    this.mesh.scale.z = radius * 2;
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
