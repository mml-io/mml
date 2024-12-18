import { Matr4Data } from "./Matr4";

export type IVect3 = { x: number; y: number; z: number };

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
}
