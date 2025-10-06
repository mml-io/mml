import { EulXYZ } from "./EulXYZ";
import { Matr4, Matr4Data } from "./Matr4";
import { Quat } from "./Quat";

export type IVect3 = { x: number; y: number; z: number };

const tempQuaternion = new Quat();

export class Vect3 {
  public x: number;
  public y: number;
  public z: number;

  constructor(x?: number | IVect3, y?: number, z?: number) {
    if (x && typeof x === "object") {
      this.x = x.x;
      this.y = x.y;
      this.z = x.z;
      return;
    }
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
  }

  copy(other: IVect3): this {
    this.x = other.x || 0;
    this.y = other.y || 0;
    this.z = other.z || 0;
    return this;
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  lengthSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  clone(): Vect3 {
    return new Vect3(this);
  }

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  applyEulerXYZ(euler: EulXYZ) {
    return this.applyQuat(tempQuaternion.setFromEulerXYZ(euler));
  }

  applyMatrix4(matrix: { data: Matr4Data }): this {
    const x = this.x;
    const y = this.y;
    const z = this.z;
    const e = matrix.data;

    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);

    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;

    return this;
  }

  transformDirection(matrix: Matr4) {
    const x = this.x;
    const y = this.y;
    const z = this.z;
    const e = matrix.data;

    this.x = e[0] * x + e[4] * y + e[8] * z;
    this.y = e[1] * x + e[5] * y + e[9] * z;
    this.z = e[2] * x + e[6] * y + e[10] * z;

    return this.normalize();
  }

  add(other: IVect3) {
    this.x += other.x || 0;
    this.y += other.y || 0;
    this.z += other.z || 0;
    return this;
  }

  sub(other: IVect3) {
    this.x -= other.x || 0;
    this.y -= other.y || 0;
    this.z -= other.z || 0;
    return this;
  }

  applyQuat(q: Quat): this {
    const vx = this.x,
      vy = this.y,
      vz = this.z;

    const qx = q.x,
      qy = q.y,
      qz = q.z,
      qw = q.w;

    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);

    this.x = vx + qw * tx + qy * tz - qz * ty;
    this.y = vy + qw * ty + qz * tx - qx * tz;
    this.z = vz + qw * tz + qx * ty - qy * tx;

    return this;
  }

  multiplyScalar(scalar: number) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  normalize() {
    return this.multiplyScalar(1 / (this.length() || 1));
  }

  addScaledVector(other: Vect3, scalar: number) {
    this.x += other.x * scalar;
    this.y += other.y * scalar;
    this.z += other.z * scalar;
    return this;
  }

  distanceTo(other: Vect3): number {
    return Math.sqrt(this.distanceToSquared(other));
  }

  distanceToSquared(other: Vect3): number {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    const dz = other.z - this.z;
    return dx * dx + dy * dy + dz * dz;
  }

  applyAxisAngle(axis: IVect3, angle: number) {
    return this.applyQuat(tempQuaternion.setFromAxisAngle(axis, angle));
  }

  min(point: IVect3): this {
    this.x = Math.min(this.x, point.x);
    this.y = Math.min(this.y, point.y);
    this.z = Math.min(this.z, point.z);
    return this;
  }

  max(point: IVect3): this {
    this.x = Math.max(this.x, point.x);
    this.y = Math.max(this.y, point.y);
    this.z = Math.max(this.z, point.z);
    return this;
  }

  subVectors(a: IVect3, b: IVect3): this {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }

  dot(v: IVect3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(other: Vect3): this {
    return this.crossVectors(this, other);
  }

  crossVectors(a: Vect3, b: Vect3) {
    const ax = a.x;
    const ay = a.y;
    const az = a.z;
    const bx = b.x;
    const by = b.y;
    const bz = b.z;

    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;

    return this;
  }

  subScalar(s: number): this {
    this.x -= s;
    this.y -= s;
    this.z -= s;
    return this;
  }

  addScalar(s: number): this {
    this.x += s;
    this.y += s;
    this.z += s;
    return this;
  }

  multiply(other: IVect3): this {
    this.x *= other.x;
    this.y *= other.y;
    this.z *= other.z;
    return this;
  }

  lerp(target: IVect3, alpha: number): Vect3 {
    this.x += (target.x - this.x) * alpha;
    this.y += (target.y - this.y) * alpha;
    this.z += (target.z - this.z) * alpha;
    return this;
  }

  lerpVectors(v1: IVect3, v2: IVect3, alpha: number): Vect3 {
    this.x = v1.x + (v2.x - v1.x) * alpha;
    this.y = v1.y + (v2.y - v1.y) * alpha;
    this.z = v1.z + (v2.z - v1.z) * alpha;
    return this;
  }

  toArray(): number[] {
    return [this.x, this.y, this.z];
  }
}
