import * as THREE from "three";

type MatrixWorldProvider = {
  matrixWorld: THREE.Matrix4;
  updateMatrixWorld(force?: boolean): void;
};

// Amount to tolerate on bounds (to avoid floating point errors)
const epsilon = 0.0001;

const matrix1 = new THREE.Matrix4();
const vector1 = new THREE.Vector3();

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

  public completelyContainsBoundingBox(childOBB: OrientedBoundingBox): boolean {
    this.matrixWorldProvider.updateMatrixWorld(true);
    childOBB.matrixWorldProvider.updateMatrixWorld(true);

    const invertedMatrix = matrix1.copy(this.matrixWorldProvider.matrixWorld).invert();

    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        for (let z = -1; z <= 1; z += 2) {
          const point = vector1.set(
            x * (childOBB.size.x / 2),
            y * (childOBB.size.y / 2),
            z * (childOBB.size.z / 2),
          );

          if (childOBB.centerOffset !== null) {
            point.add(childOBB.centerOffset);
          }

          point.applyMatrix4(childOBB.matrixWorldProvider.matrixWorld);

          const localPoint = point.applyMatrix4(invertedMatrix);
          if (this.centerOffset !== null) {
            localPoint.sub(this.centerOffset);
          }
          const isWithin =
            Math.abs(localPoint.x) <= this.size.x / 2 + epsilon &&
            Math.abs(localPoint.y) <= this.size.y / 2 + epsilon &&
            Math.abs(localPoint.z) <= this.size.z / 2 + epsilon;

          if (!isWithin) {
            return false;
          }
        }
      }
    }

    return true;
  }

  public containsPoint(point: THREE.Vector3): boolean {
    this.matrixWorldProvider.updateMatrixWorld(true);
    const invertedMatrix = matrix1.copy(this.matrixWorldProvider.matrixWorld).invert();

    const localPoint = vector1.copy(point).applyMatrix4(invertedMatrix);
    if (this.centerOffset !== null) {
      localPoint.sub(this.centerOffset);
    }
    return (
      Math.abs(localPoint.x) <= this.size.x / 2 + epsilon &&
      Math.abs(localPoint.y) <= this.size.y / 2 + epsilon &&
      Math.abs(localPoint.z) <= this.size.z / 2 + epsilon
    );
  }
}
