// Largely based on https://github.com/mrdoob/three.js/blob/master/src/math/Quaternion.js

import { Matr4 } from "./Matr4";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

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

  invert() {
    this.x *= -1;
    this.y *= -1;
    this.z *= -1;
    return this;
  }

  dot(other: Quat): number {
    return this.x * other.x + this.y * other.y + this.z * other.z + this.w * other.w;
  }

  rotateTowards(other: Quat, scalar: number): this {
    const angle = this.angleTo(other);

    if (angle === 0) {
      return this;
    }

    const t = Math.min(1, scalar / angle);

    this.slerp(other, t);

    return this;
  }

  angleTo(q: Quat): number {
    return 2 * Math.acos(Math.abs(clamp(this.dot(q), -1, 1)));
  }

  slerp(qb: Quat, t: number): this {
    if (t <= 0) return this;
    if (t >= 1) return this.copy(qb);

    const x1 = this.x,
      y1 = this.y,
      z1 = this.z,
      w1 = this.w;
    let x2 = qb.x,
      y2 = qb.y,
      z2 = qb.z,
      w2 = qb.w;

    let cosHalfTheta = w1 * w2 + x1 * x2 + y1 * y2 + z1 * z2;

    if (cosHalfTheta < 0) {
      w2 = -w2;
      x2 = -x2;
      y2 = -y2;
      z2 = -z2;
      cosHalfTheta = -cosHalfTheta;
    }

    if (cosHalfTheta >= 1.0) {
      return this.set(x1, y1, z1, w1);
    }

    const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);

    if (sinHalfTheta < 0.001) {
      this.w = 0.5 * (w1 + w2);
      this.x = 0.5 * (x1 + x2);
      this.y = 0.5 * (y1 + y2);
      this.z = 0.5 * (z1 + z2);
      return this.normalize();
    }

    const halfTheta = Math.acos(cosHalfTheta);
    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

    this.w = w1 * ratioA + w2 * ratioB;
    this.x = x1 * ratioA + x2 * ratioB;
    this.y = y1 * ratioA + y2 * ratioB;
    this.z = z1 * ratioA + z2 * ratioB;

    return this.normalize();
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  }

  normalize(): this {
    let l = this.length();

    if (l === 0) {
      this.x = 0;
      this.y = 0;
      this.z = 0;
      this.w = 1;
    } else {
      l = 1 / l;
      this.x = this.x * l;
      this.y = this.y * l;
      this.z = this.z * l;
      this.w = this.w * l;
    }

    return this;
  }
}
