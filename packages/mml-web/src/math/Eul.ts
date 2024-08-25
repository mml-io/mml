import { Matr4 } from "./Matr4";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export class EulXYZ {
  private static tempMatrix = new Matr4();
  public x: number;
  public y: number;
  public z: number;

  constructor(x?: number | EulXYZ, y?: number, z?: number) {
    if (x instanceof EulXYZ) {
      this.x = x.x;
      this.y = x.y;
      this.z = x.z;
      return;
    }
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
  }

  setFromRotationMatrix(m: Matr4): this {
    // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)

    const te = m.data;
    const m11 = te[0];
    const m12 = te[4];
    const m13 = te[8];
    const m22 = te[5];
    const m23 = te[9];
    const m32 = te[6];
    const m33 = te[10];

    this.y = Math.asin(clamp(m13, -1, 1));

    if (Math.abs(m13) < 0.9999999) {
      this.x = Math.atan2(-m23, m33);
      this.z = Math.atan2(-m12, m11);
    } else {
      this.x = Math.atan2(m32, m22);
      this.z = 0;
    }

    return this;
  }

  setFromQuaternion(q: { x: number; y: number; z: number; w: number }): this {
    const _matrix = EulXYZ.tempMatrix;
    _matrix.makeRotationFromQuaternion(q);

    return this.setFromRotationMatrix(_matrix);
  }

  copy(other: { x?: number; y?: number; z?: number }): this {
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

  clone(): EulXYZ {
    return new EulXYZ(this);
  }

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}
