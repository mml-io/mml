import * as THREE from "three";

type MatrixWorldProvider = {
  matrixWorld: THREE.Matrix4;
  updateMatrixWorld(force?: boolean): void;
};

const epsilon = 0.0001;

export class OrientedBoundingBox {
  private constructor(
    public size: THREE.Vector3,
    public matrixWorldProvider: MatrixWorldProvider,
    public centerOffset: THREE.Vector3 | null = null,
  ) {}

  static fromSizeAndMatrixWorldProvider(
    size: THREE.Vector3,
    matrixWorldProvider: MatrixWorldProvider,
  ): OrientedBoundingBox {
    return new OrientedBoundingBox(size, matrixWorldProvider);
  }

  static fromSizeMatrixWorldProviderAndCenter(
    size: THREE.Vector3,
    matrixWorldProvider: MatrixWorldProvider,
    centerOffset: THREE.Vector3,
  ): OrientedBoundingBox {
    return new OrientedBoundingBox(size, matrixWorldProvider, centerOffset);
  }

  static fromMatrixWorldProvider(matrixWorldProvider: MatrixWorldProvider): OrientedBoundingBox {
    return new OrientedBoundingBox(new THREE.Vector3(), matrixWorldProvider);
  }

  public containsPoint(point: THREE.Vector3): boolean {
    this.matrixWorldProvider.updateMatrixWorld(true);
    const localPoint = point
      .clone()
      .applyMatrix4(this.matrixWorldProvider.matrixWorld.clone().invert());
    if (this.centerOffset !== null) {
      localPoint.sub(this.centerOffset);
    }
    return (
      Math.abs(localPoint.x) <= (this.size.x + epsilon) / 2 &&
      Math.abs(localPoint.y) <= (this.size.y + epsilon) / 2 &&
      Math.abs(localPoint.z) <= (this.size.z + epsilon) / 2
    );
  }
}
