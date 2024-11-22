import { Cube } from "@mml-io/mml-web";
import { CubeGraphics } from "@mml-io/mml-web";
import { MMLColor } from "@mml-io/mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export class ThreeJSCube extends CubeGraphics<ThreeJSGraphicsAdapter> {
  static boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private mesh: THREE.Mesh<THREE.BoxGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial;
  constructor(private cube: Cube<ThreeJSGraphicsAdapter>) {
    super(cube);

    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cube.props.color.r, cube.props.color.g, cube.props.color.b),
    });
    this.mesh = new THREE.Mesh(ThreeJSCube.boxGeometry, this.material);
    this.mesh.castShadow = cube.props.castShadows;
    this.mesh.receiveShadow = true;
    this.cube.getContainer().add(this.mesh);
  }

  disable(): void {}

  enable(): void {}

  getCollisionElement(): THREE.Object3D<THREE.Object3DEventMap> {
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

  setDepth(depth: number): void {
    this.mesh.scale.z = depth;
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
