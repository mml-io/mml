import { Matr4 } from "../math/Matr4";
import { IVect3, Vect3 } from "../math/Vect3";

// Amount to tolerate on bounds (to avoid floating point errors)
const epsilon = 0.0001;

const matrix1 = new Matr4();
const vector1 = new Vect3();

export class OrientedBoundingBox {
  private constructor(
    public size: IVect3,
    public matr4: Matr4,
    public centerOffset: IVect3 | null = null,
  ) {}

  static fromSizeAndMatrixWorld(size: Vect3, matr4: Matr4): OrientedBoundingBox {
    return new OrientedBoundingBox(size, matr4);
  }

  static fromSizeMatrixWorldAndCenter(
    size: IVect3,
    matr4: Matr4,
    centerOffset: IVect3,
  ): OrientedBoundingBox {
    return new OrientedBoundingBox(size, matr4, centerOffset);
  }

  static fromMatrixWorld(matr4: Matr4): OrientedBoundingBox {
    return new OrientedBoundingBox(new Vect3(), matr4);
  }

  public getCorners(): Vect3[] {
    const corners: Vect3[] = [];
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        for (let z = -1; z <= 1; z += 2) {
          const point = vector1.set(
            x * (this.size.x / 2),
            y * (this.size.y / 2),
            z * (this.size.z / 2),
          );

          if (this.centerOffset !== null) {
            point.add(this.centerOffset);
          }

          point.applyMatrix4(this.matr4);
          corners.push(point.clone());
        }
      }
    }
    return corners;
  }

  public completelyContainsBoundingBox(childOBB: OrientedBoundingBox): boolean {
    const invertedMatrix = matrix1.copy(this.matr4).invert();

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

          point.applyMatrix4(childOBB.matr4);

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

  public containsPoint(point: { x: number; y: number; z: number }): boolean {
    const invertedMatrix = matrix1.copy(this.matr4).invert();

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
