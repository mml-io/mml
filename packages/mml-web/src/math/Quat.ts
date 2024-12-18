// Largely based on https://github.com/mrdoob/three.js/blob/master/src/math/Quaternion.js

import { Matr4 } from "./Matr4";

export class Quat {
  public x: number;
  public y: number;
  public z: number;
  public w: number;

  constructor(x?: number | Quat, y?: number, z?: number, w?: number) {
    if (x instanceof Quat) {
      this.x = x.x;
      this.y = x.y;
      this.z = x.z;
      this.w = x.w;
      return;
    }
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
    this.w = w || 1;
  }

  copy(other: { x?: number; y?: number; z?: number; w?: number }): this {
    this.x = other.x || 0;
    this.y = other.y || 0;
    this.z = other.z || 0;
    this.w = other.w || 0;
    return this;
  }

  multiply(q: { x: number; y: number; z: number; w: number }): this {
    return this.multiplyQuaternions(this, q);
  }

  premultiply(q: { x: number; y: number; z: number; w: number }): this {
    return this.multiplyQuaternions(q, this);
  }

  multiplyQuaternions(
    a: { x: number; y: number; z: number; w: number },
    b: { x: number; y: number; z: number; w: number },
  ): this {
    const qax = a.x;
    const qay = a.y;
    const qaz = a.z;
    const qaw = a.w;
    const qbx = b.x;
    const qby = b.y;
    const qbz = b.z;
    const qbw = b.w;

    this.x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
    this.y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    this.z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
    this.w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;

    return this;
  }

  setFromEulerXYZ(euler: { x: number; y: number; z: number }): this {
    const x = euler.x;
    const y = euler.y;
    const z = euler.z;

    const cos = Math.cos;
    const sin = Math.sin;

    const c1 = cos(x / 2);
    const c2 = cos(y / 2);
    const c3 = cos(z / 2);

    const s1 = sin(x / 2);
    const s2 = sin(y / 2);
    const s3 = sin(z / 2);

    this.x = s1 * c2 * c3 + c1 * s2 * s3;
    this.y = c1 * s2 * c3 - s1 * c2 * s3;
    this.z = c1 * c2 * s3 + s1 * s2 * c3;
    this.w = c1 * c2 * c3 - s1 * s2 * s3;

    return this;
  }

  setFromRotationMatrix(m: Matr4): this {
    // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
    const te = m.data,
      m11 = te[0],
      m12 = te[4],
      m13 = te[8],
      m21 = te[1],
      m22 = te[5],
      m23 = te[9],
      m31 = te[2],
      m32 = te[6],
      m33 = te[10],
      trace = m11 + m22 + m33;

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);

      this.w = 0.25 / s;
      this.x = (m32 - m23) * s;
      this.y = (m13 - m31) * s;
      this.z = (m21 - m12) * s;
    } else if (m11 > m22 && m11 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);

      this.w = (m32 - m23) / s;
      this.x = 0.25 * s;
      this.y = (m12 + m21) / s;
      this.z = (m13 + m31) / s;
    } else if (m22 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);

      this.w = (m13 - m31) / s;
      this.x = (m12 + m21) / s;
      this.y = 0.25 * s;
      this.z = (m23 + m32) / s;
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);

      this.w = (m21 - m12) / s;
      this.x = (m13 + m31) / s;
      this.y = (m23 + m32) / s;
      this.z = 0.25 * s;
    }

    return this;
  }

  setFromAxisAngle(axis: { x: number; y: number; z: number }, angle: number): this {
    // assumes axis is normalized

    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);

    this.x = axis.x * s;
    this.y = axis.y * s;
    this.z = axis.z * s;
    this.w = Math.cos(halfAngle);

    return this;
  }

  clone(): Quat {
    return new Quat(this);
  }

  set(x: number, y: number, z: number, w: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }
}
