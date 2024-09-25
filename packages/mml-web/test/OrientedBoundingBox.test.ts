import { Matr4, OrientedBoundingBox, Vect3 } from "../build/index";

function createBox(size: Vect3, matrixWorld: Matr4, centerOffset: Vect3 | null = null) {
  const box = OrientedBoundingBox.fromSizeMatrixWorldAndCenter(
    size,
    matrixWorld,
    centerOffset || new Vect3(),
  );
  return { box };
}

describe("OrientedBoundingBox", () => {
  describe("completelyContainsBoundingBox", () => {
    it("should return true when the current OBB completely contains the child OBB", () => {
      const parent = createBox(new Vect3(10, 10, 10), new Matr4());
      const child = createBox(new Vect3(5, 5, 5), new Matr4(), new Vect3(2, 2, 2));
      expect(parent.box.completelyContainsBoundingBox(child.box)).toBe(true);
    });

    it("should return false when the current OBB doesn't completely contains the child OBB", () => {
      const parent = createBox(new Vect3(10, 10, 10), new Matr4());
      const child = createBox(new Vect3(20, 20, 20), new Matr4(), new Vect3(2, 2, 2));
      expect(parent.box.completelyContainsBoundingBox(child.box)).toBe(false);
    });

    it("should handle the transformation matrix correctly", () => {
      const parentTransformMatrix = new Matr4().makeRotationY(Math.PI / 4);
      const parent = createBox(new Vect3(10, 10, 10), parentTransformMatrix);

      const childTransformMatrix = new Matr4().makeTranslation(2, 2, 2);
      const child = createBox(new Vect3(3, 3, 3), childTransformMatrix);

      expect(parent.box.completelyContainsBoundingBox(child.box)).toBe(true);
    });

    it("should handle negative scales", () => {
      const parent = createBox(new Vect3(10, 10, 10), new Matr4().makeScale(1, -1, 1));
      const child = createBox(new Vect3(5, 5, 5), new Matr4());
      expect(parent.box.completelyContainsBoundingBox(child.box)).toBe(true);
    });
  });

  describe("containsPoint", () => {
    it("should return true the point is inside the box", () => {
      const { box } = createBox(new Vect3(10, 10, 10), new Matr4());
      expect(box.containsPoint(new Vect3(0, 0, 0))).toBe(true);
    });

    it("should return false if the point is outside the box", () => {
      const { box } = createBox(new Vect3(10, 10, 10), new Matr4());
      expect(box.containsPoint(new Vect3(11, 11, 11))).toBe(false);
    });

    it("should properly handle the transformation matrix", () => {
      const { box: withoutRotatation } = createBox(new Vect3(10, 10, 10), new Matr4());
      expect(withoutRotatation.containsPoint(new Vect3(0, 0, 0))).toBe(true);
      expect(withoutRotatation.containsPoint(new Vect3(5, 0, 5))).toBe(true);
      expect(withoutRotatation.containsPoint(new Vect3(6, 0, 0))).toBe(false);
      expect(withoutRotatation.containsPoint(new Vect3(0, 0, 6))).toBe(false);

      const { box: withRotation } = createBox(
        new Vect3(10, 10, 10),
        new Matr4().makeRotationY(Math.PI / 4),
      );
      expect(withRotation.containsPoint(new Vect3(3, 0, 3))).toBe(true);
      expect(withRotation.containsPoint(new Vect3(3, 0, 3))).toBe(true);
      expect(withRotation.containsPoint(new Vect3(6, 0, 0))).toBe(true);
      expect(withRotation.containsPoint(new Vect3(0, 0, 6))).toBe(true);
    });

    it("should properly handle the center offset", () => {
      const { box } = createBox(new Vect3(10, 10, 10), new Matr4(), new Vect3(3, 3, 3));
      expect(box.containsPoint(new Vect3(-3, -3, -3))).toBe(false);
      expect(box.containsPoint(new Vect3(0, 0, 0))).toBe(true);
      expect(box.containsPoint(new Vect3(4, 4, 4))).toBe(true);
    });
  });
});
