export class Vect3 {
  public x: number;
  public y: number;
  public z: number;

  constructor(x?: number | Vect3, y?: number, z?: number) {
    if (x instanceof Vect3) {
      this.x = x.x;
      this.y = x.y;
      this.z = x.z;
      return;
    }
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
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

  clone(): Vect3 {
    return new Vect3(this);
  }

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}
