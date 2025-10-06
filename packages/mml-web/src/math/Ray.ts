// Largely from https://github.com/mrdoob/three.js/blob/dev/src/math/Ray.js

import { Matr4 } from "./Matr4";
import { IVect3, Vect3 } from "./Vect3";

const _edge1 = new Vect3();
const _edge2 = new Vect3();
const _normal = new Vect3();
const _diff = new Vect3();

export class Ray {
  public origin = new Vect3();
  public direction = new Vect3();

  constructor(origin?: IVect3, direction?: IVect3) {
    if (origin) {
      this.origin.copy(origin);
    }
    if (direction) {
      this.direction.copy(direction);
    }
  }

  setOrigin(origin: IVect3): this {
    this.origin.copy(origin);
    return this;
  }

  setDirection(direction: IVect3): this {
    this.direction.copy(direction);
    return this;
  }

  clone(): Ray {
    return new Ray(this.origin, this.direction);
  }

  set(origin: IVect3, direction: IVect3): this {
    this.origin.copy(origin);
    this.direction.copy(direction);
    return this;
  }

  copy(ray: Ray): this {
    this.origin.copy(ray.origin);
    this.direction.copy(ray.direction);
    return this;
  }

  applyMatrix4(matr4: Matr4): this {
    this.origin.applyMatrix4(matr4);
    this.direction.transformDirection(matr4);
    return this;
  }

  intersectTriangle(a: Vect3, b: Vect3, c: Vect3, backfaceCulling: boolean, target: Vect3) {
    _edge1.subVectors(b, a);
    _edge2.subVectors(c, a);
    _normal.crossVectors(_edge1, _edge2);

    let DdN = this.direction.dot(_normal);
    let sign;

    if (DdN > 0) {
      if (backfaceCulling) return null;
      sign = 1;
    } else if (DdN < 0) {
      sign = -1;
      DdN = -DdN;
    } else {
      return null;
    }

    _diff.subVectors(this.origin, a);
    const DdQxE2 = sign * this.direction.dot(_edge2.crossVectors(_diff, _edge2));

    // b1 < 0, no intersection
    if (DdQxE2 < 0) {
      return null;
    }

    const DdE1xQ = sign * this.direction.dot(_edge1.cross(_diff));

    // b2 < 0, no intersection
    if (DdE1xQ < 0) {
      return null;
    }

    // b1+b2 > 1, no intersection
    if (DdQxE2 + DdE1xQ > DdN) {
      return null;
    }

    // Line intersects triangle, check if ray does.
    const QdN = -sign * _diff.dot(_normal);

    // t < 0, no intersection
    if (QdN < 0) {
      return null;
    }

    // Ray intersects triangle.
    return this.at(QdN / DdN, target);
  }

  public at(t: number, target: Vect3): Vect3 {
    return target.copy(this.origin).addScaledVector(this.direction, t);
  }
}
