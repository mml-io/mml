import { jest } from "@jest/globals";
import { Matrix4, Vector3 } from "three";

import { OrientedBoundingBox } from "../src/utils/OrientedBoundingBox";

function createBox(size: Vector3, matrixWorld: Matrix4, centerOffset: Vector3 | null = null) {
  const matrixWorldProvider = {
    matrixWorld,
    updateMatrixWorld: jest.fn(),
  };
  const box = OrientedBoundingBox.fromSizeMatrixWorldProviderAndCenter(
    size,
    matrixWorldProvider,
    centerOffset || new Vector3(),
  );
  return { box, matrixWorldProvider };
}

describe("OrientedBoundingBox", () => {
  describe("completelyContainsBoundingBox", () => {
    it("should return true when the current OBB completely contains the child OBB", () => {
      const parent = createBox(new Vector3(10, 10, 10), new Matrix4());
      const child = createBox(new Vector3(5, 5, 5), new Matrix4(), new Vector3(2, 2, 2));
      expect(parent.box.completelyContainsBoundingBox(child.box)).toBe(true);
      expect(parent.matrixWorldProvider.updateMatrixWorld).toHaveBeenCalledTimes(1);
      expect(child.matrixWorldProvider.updateMatrixWorld).toHaveBeenCalledTimes(1);
    });

    it("should return false when the current OBB doesn't completely contains the child OBB", () => {
      const parent = createBox(new Vector3(10, 10, 10), new Matrix4());
      const child = createBox(new Vector3(20, 20, 20), new Matrix4(), new Vector3(2, 2, 2));
      expect(parent.box.completelyContainsBoundingBox(child.box)).toBe(false);
    });

    it("should handle the transformation matrix correctly", () => {
      const parentTransformMatrix = new Matrix4().makeRotationY(Math.PI / 4);
      const parent = createBox(new Vector3(10, 10, 10), parentTransformMatrix);

      const childTransformMatrix = new Matrix4().makeTranslation(2, 2, 2);
      const child = createBox(new Vector3(3, 3, 3), childTransformMatrix);

      expect(parent.box.completelyContainsBoundingBox(child.box)).toBe(true);
    });

    it("should handle negative scales", () => {
      const parent = createBox(new Vector3(10, 10, 10), new Matrix4().makeScale(1, -1, 1));
      const child = createBox(new Vector3(5, 5, 5), new Matrix4());
      expect(parent.box.completelyContainsBoundingBox(child.box)).toBe(true);
    });
  });

  describe("containsPoint", () => {
    it("should return true the point is inside the box", () => {
      const { box } = createBox(new Vector3(10, 10, 10), new Matrix4());
      expect(box.containsPoint(new Vector3(0, 0, 0))).toBe(true);
    });

    it("should return false if the point is outside the box", () => {
      const { box } = createBox(new Vector3(10, 10, 10), new Matrix4());
      expect(box.containsPoint(new Vector3(11, 11, 11))).toBe(false);
    });

    it("should properly handle the transformation matrix", () => {
      const { box: withoutRotatation } = createBox(new Vector3(10, 10, 10), new Matrix4());
      expect(withoutRotatation.containsPoint(new Vector3(0, 0, 0))).toBe(true);
      expect(withoutRotatation.containsPoint(new Vector3(5, 0, 5))).toBe(true);
      expect(withoutRotatation.containsPoint(new Vector3(6, 0, 0))).toBe(false);
      expect(withoutRotatation.containsPoint(new Vector3(0, 0, 6))).toBe(false);

      const { box: withRotation } = createBox(
        new Vector3(10, 10, 10),
        new Matrix4().makeRotationY(Math.PI / 4),
      );
      expect(withRotation.containsPoint(new Vector3(3, 0, 3))).toBe(true);
      expect(withRotation.containsPoint(new Vector3(3, 0, 3))).toBe(true);
      expect(withRotation.containsPoint(new Vector3(6, 0, 0))).toBe(true);
      expect(withRotation.containsPoint(new Vector3(0, 0, 6))).toBe(true);
    });

    it("should properly handle the center offset", () => {
      const { box } = createBox(new Vector3(10, 10, 10), new Matrix4(), new Vector3(3, 3, 3));
      expect(box.containsPoint(new Vector3(-3, -3, -3))).toBe(false);
      expect(box.containsPoint(new Vector3(0, 0, 0))).toBe(true);
      expect(box.containsPoint(new Vector3(4, 4, 4))).toBe(true);
    });
  });
});
