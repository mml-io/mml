import { clamp } from "./math-helpers";

import { Matr4 } from "./Matr4";
import { IVect3, Vect3 } from "./Vect3";

const _startP = new Vect3();
const _startEnd = new Vect3();

export class Line {
  public start = new Vect3();
  public end = new Vect3();

  constructor(start?: IVect3, end?: IVect3) {
    if (start) {
      this.start.copy(start);
    }
    if (end) {
      this.end.copy(end);
    }
  }

  setStart(start: IVect3): this {
    this.start.copy(start);
    return this;
  }

  setEnd(end: IVect3): this {
    this.end.copy(end);
    return this;
  }

  length(): number {
    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    const dz = this.end.z - this.start.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  lengthSquared(): number {
    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    const dz = this.end.z - this.start.z;
    return dx * dx + dy * dy + dz * dz;
  }

  clone(): Line {
    return new Line(this.start, this.end);
  }

  copy(other: Line): this {
    this.start.copy(other.start);
    this.end.copy(other.end);
    return this;
  }

  applyMatrix4(matr4: Matr4): this {
    this.start.applyMatrix4(matr4);
    this.end.applyMatrix4(matr4);
    return this;
  }

  distance(): number {
    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    const dz = this.end.z - this.start.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  at(t: number, target: Vect3): Vect3 {
    target.x = this.start.x + t * (this.end.x - this.start.x);
    target.y = this.start.y + t * (this.end.y - this.start.y);
    target.z = this.start.z + t * (this.end.z - this.start.z);
    return target;
  }

  closestPointToPointParameter(point: Vect3, clampToLine: boolean) {
    _startP.subVectors(point, this.start);
    _startEnd.subVectors(this.end, this.start);

    const startEnd2 = _startEnd.dot(_startEnd);
    const startEnd_startP = _startEnd.dot(_startP);

    let t = startEnd_startP / startEnd2;

    if (clampToLine) {
      t = clamp(t, 0, 1);
    }

    return t;
  }

  closestPointToPoint(point: Vect3, clampToLine: boolean, target: Vect3): Vect3 {
    const t = this.closestPointToPointParameter(point, clampToLine);

    return this.delta(target).multiplyScalar(t).add(this.start);
  }

  delta(target: Vect3): Vect3 {
    return target.subVectors(this.end, this.start);
  }
}
