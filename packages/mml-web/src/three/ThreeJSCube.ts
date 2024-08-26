import * as THREE from "three";

import { Cube, MCubeProps } from "../elements";
import { CubeGraphics, MMLColor } from "../MMLGraphicsInterface";

export class ThreeJSCube extends CubeGraphics {
  static boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private mesh: THREE.Mesh<THREE.BoxGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial;

  constructor(private cube: Cube) {
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

  setColor(color: MMLColor, mCubeProps: MCubeProps): void {
    this.material.color = new THREE.Color(color.r, color.g, color.b);
  }

  setWidth(width: number, mCubeProps: MCubeProps): void {
    this.mesh.scale.x = width;
  }

  setHeight(height: number, mCubeProps: MCubeProps): void {
    this.mesh.scale.y = height;
  }

  setDepth(depth: number, mCubeProps: MCubeProps): void {
    this.mesh.scale.z = depth;
  }

  setCastShadows(castShadows: boolean, mCubeProps: MCubeProps): void {
    this.mesh.castShadow = castShadows;
  }

  setOpacity(opacity: number, mCubeProps: MCubeProps): void {
    const needsUpdate = this.material.transparent === (opacity === 1);
    this.material.transparent = opacity !== 1;
    this.material.needsUpdate = needsUpdate;
    this.material.opacity = opacity;
  }

  dispose() {}
}
