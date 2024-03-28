import * as THREE from "three";

type MatrixWorldProvider = {
  matrixWorld: THREE.Matrix4;
};

export class OrientedBoundingBox {
  private constructor(
    public size: THREE.Vector3,
    public matrixWorldProvider: MatrixWorldProvider,
  ) {
    console.log("OrientedBoundingBox.constructor", this.size, this.matrixWorldProvider);
  }

  static fromSizeAndMatrixWorldProvider(
    size: THREE.Vector3,
    matrixWorldProvider: MatrixWorldProvider,
  ): OrientedBoundingBox {
    return new OrientedBoundingBox(size, matrixWorldProvider);
  }

  static fromMatrixWorldProvider(matrixWorldProvider: MatrixWorldProvider): OrientedBoundingBox {
    return new OrientedBoundingBox(new THREE.Vector3(), matrixWorldProvider);
  }

  containsPoint(point: THREE.Vector3): boolean {
    const localPoint = point.clone().applyMatrix4(this.matrixWorldProvider.matrixWorld);
    return (
      Math.abs(localPoint.x) <= this.size.x / 2 &&
      Math.abs(localPoint.y) <= this.size.y / 2 &&
      Math.abs(localPoint.z) <= this.size.z / 2
    );
  }
}
