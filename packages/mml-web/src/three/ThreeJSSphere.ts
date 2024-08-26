import * as THREE from "three";

import { MSphereProps, Sphere } from "../elements";
import { MMLColor, SphereGraphics } from "../MMLGraphicsInterface";

const defaultSphereWidthSegments = 16;
const defaultSphereHeightSegments = 16;

export class ThreeJSSphere extends SphereGraphics {
  static sphereGeometry = new THREE.SphereGeometry(
    0.5,
    defaultSphereWidthSegments,
    defaultSphereHeightSegments,
  );
  private mesh: THREE.Mesh<THREE.BoxGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial;

  constructor(private sphere: Sphere) {
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

  setColor(color: MMLColor, mSphereProps: MSphereProps): void {
    this.material.color = new THREE.Color(color.r, color.g, color.b);
  }

  setRadius(radius: number, mSphereProps: MSphereProps): void {
    this.mesh.scale.x = radius;
    this.mesh.scale.y = radius;
    this.mesh.scale.z = radius;
  }

  setCastShadows(castShadows: boolean, mSphereProps: MSphereProps): void {
    this.mesh.castShadow = castShadows;
  }

  setOpacity(opacity: number, mSphereProps: MSphereProps): void {
    const needsUpdate = this.material.transparent === (opacity === 1);
    this.material.transparent = opacity !== 1;
    this.material.needsUpdate = needsUpdate;
    this.material.opacity = opacity;
  }

  dispose() {}
}
