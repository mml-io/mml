/**
 * Immutable 3D vector utility.
 *
 * All operations return new instances (no in-place mutation).
 */
export class Vec3 {
  x: number;
  y: number;
  z: number;

  /** Create a new vector with components (x, y, z). */
  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  /** A vector with all components equal to 0. */
  static zero(): Vec3 {
    return new Vec3(0, 0, 0);
  }

  /** A vector with all components equal to 1. */
  static one(): Vec3 {
    return new Vec3(1, 1, 1);
  }

  /** Create a vector from a plain object with x/y/z fields. */
  static from(v: { x: number; y: number; z: number }): Vec3 {
    return new Vec3(v.x, v.y, v.z);
  }

  /** Return a copy of this vector. */
  clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }

  /** Component-wise addition. */
  add(other: Vec3): Vec3 {
    return new Vec3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  /** Component-wise subtraction. */
  sub(other: Vec3): Vec3 {
    return new Vec3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  /** Component-wise multiplication (Hadamard product). */
  mul(other: Vec3): Vec3 {
    return new Vec3(this.x * other.x, this.y * other.y, this.z * other.z);
  }

  /** Component-wise division. */
  div(other: Vec3): Vec3 {
    return new Vec3(this.x / other.x, this.y / other.y, this.z / other.z);
  }

  /** Multiply all components by a scalar. */
  scale(scalar: number): Vec3 {
    return new Vec3(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  /** Convert to a plain object with x/y/z fields. */
  toObject(): { x: number; y: number; z: number } {
    return { x: this.x, y: this.y, z: this.z };
  }
}
