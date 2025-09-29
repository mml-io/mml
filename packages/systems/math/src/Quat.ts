import { clamp } from ".";
import { Vec3 } from "./Vec3";

/**
 * Quaternion represented as (x, y, z, w).
 *
 * Provides helpers for constructing from Euler degrees, normalizing,
 * multiplying, conjugating, rotating vectors and converting to Euler angles.
 * All operations return new instances (no in-place mutation).
 */
export class Quat {
  x: number;
  y: number;
  z: number;
  w: number;

  /** Create a new quaternion with components (x, y, z, w). */
  constructor(x: number, y: number, z: number, w: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  /** Identity quaternion (no rotation). */
  static identity(): Quat {
    return new Quat(0, 0, 0, 1);
  }

  /** Create a quaternion from a plain object with x/y/z/w fields. */
  static from(obj: { x: number; y: number; z: number; w: number }): Quat {
    return new Quat(obj.x, obj.y, obj.z, obj.w);
  }

  /** Create a quaternion from Euler rotation in degrees, order XYZ. */
  static fromEulerDegrees(rxDeg: number, ryDeg: number, rzDeg: number): Quat {
    const x = (rxDeg * Math.PI) / 180;
    const y = (ryDeg * Math.PI) / 180;
    const z = (rzDeg * Math.PI) / 180;

    const c1 = Math.cos(x / 2);
    const c2 = Math.cos(y / 2);
    const c3 = Math.cos(z / 2);
    const s1 = Math.sin(x / 2);
    const s2 = Math.sin(y / 2);
    const s3 = Math.sin(z / 2);

    const qx = s1 * c2 * c3 + c1 * s2 * s3;
    const qy = c1 * s2 * c3 - s1 * c2 * s3;
    const qz = c1 * c2 * s3 + s1 * s2 * c3;
    const qw = c1 * c2 * c3 - s1 * s2 * s3;

    return new Quat(qx, qy, qz, qw).normalize();
  }

  /** Return a copy of this quaternion. */
  clone(): Quat {
    return new Quat(this.x, this.y, this.z, this.w);
  }

  /** Return a normalized copy of this quaternion. */
  normalize(): Quat {
    const len = Math.hypot(this.x, this.y, this.z, this.w);
    if (len === 0) return Quat.identity();
    return new Quat(this.x / len, this.y / len, this.z / len, this.w / len);
  }

  /** Hamilton product: combine rotations (this followed by b). */
  multiply(b: Quat): Quat {
    return new Quat(
      this.w * b.x + this.x * b.w + this.y * b.z - this.z * b.y,
      this.w * b.y - this.x * b.z + this.y * b.w + this.z * b.x,
      this.w * b.z + this.x * b.y - this.y * b.x + this.z * b.w,
      this.w * b.w - this.x * b.x - this.y * b.y - this.z * b.z,
    );
  }

  /** Conjugate quaternion (inverse for unit quaternions). */
  conjugate(): Quat {
    return new Quat(-this.x, -this.y, -this.z, this.w);
  }

  /** Rotate a vector by this quaternion. */
  rotateVector(v: Vec3): Vec3 {
    const qx = this.x,
      qy = this.y,
      qz = this.z,
      qw = this.w;
    const vx = v.x,
      vy = v.y,
      vz = v.z;

    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);

    return new Vec3(
      vx + qw * tx + (qy * tz - qz * ty),
      vy + qw * ty + (qz * tx - qx * tz),
      vz + qw * tz + (qx * ty - qy * tx),
    );
  }

  /** Convert to Euler angles (radians), order XYZ. */
  toEulerXYZ(): { x: number; y: number; z: number } {
    const nq = this.normalize();

    const x = nq.x,
      y = nq.y,
      z = nq.z,
      w = nq.w;
    const x2 = x + x,
      y2 = y + y,
      z2 = z + z;
    const xx = x * x2,
      xy = x * y2,
      xz = x * z2;
    const yy = y * y2,
      yz = y * z2,
      zz = z * z2;
    const wx = w * x2,
      wy = w * y2,
      wz = w * z2;

    const m11 = 1 - (yy + zz);
    const m12 = xy - wz;
    const m13 = xz + wy;

    const m23 = yz - wx;
    const m33 = 1 - (xx + yy);

    const sy = clamp(m13, -1, 1);
    const eulerY = Math.asin(sy);

    let eulerX: number;
    let eulerZ: number;

    if (Math.abs(m13) < 0.9999999) {
      eulerX = Math.atan2(-m23, m33);
      eulerZ = Math.atan2(-m12, m11);
    } else {
      const m22 = 1 - (xx + zz);
      const m32 = yz + wx;
      eulerX = Math.atan2(m32, m22);
      eulerZ = 0;
    }

    return { x: eulerX, y: eulerY, z: eulerZ };
  }
}
