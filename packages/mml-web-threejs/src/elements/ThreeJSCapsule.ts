import { Capsule, CapsuleGraphics, MMLColor } from "@mml-io/mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

const defaultCapsuleCapSegments = 16;
const defaultCapsuleRadialSegments = 16;

export class ThreeJSCapsule extends CapsuleGraphics<ThreeJSGraphicsAdapter> {
  private mesh: THREE.Mesh<THREE.CapsuleGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial;
  private currentRadius: number;
  private currentHeight: number;

  constructor(private capsule: Capsule<ThreeJSGraphicsAdapter>) {
    super(capsule);

    this.currentRadius = capsule.props.radius;
    this.currentHeight = capsule.props.height;

    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(capsule.props.color.r, capsule.props.color.g, capsule.props.color.b),
    });

    const geometry = new THREE.CapsuleGeometry(
      this.currentRadius,
      this.currentHeight,
      defaultCapsuleCapSegments,
      defaultCapsuleRadialSegments,
    );
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.castShadow = capsule.props.castShadows;
    this.mesh.receiveShadow = true;
    this.capsule.getContainer().add(this.mesh);
  }

  disable(): void {}

  enable(): void {}

  getCollisionElement(): THREE.Object3D {
    return this.mesh;
  }

  setColor(color: MMLColor): void {
    this.material.color = new THREE.Color(color.r, color.g, color.b);
  }

  private rebuildGeometry(): void {
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.CapsuleGeometry(
      this.currentRadius,
      this.currentHeight,
      defaultCapsuleCapSegments,
      defaultCapsuleRadialSegments,
    );
  }

  setRadius(radius: number): void {
    this.currentRadius = radius;
    this.rebuildGeometry();
  }

  setHeight(height: number): void {
    this.currentHeight = height;
    this.rebuildGeometry();
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

  dispose() {
    this.mesh.geometry.dispose();
  }
}
