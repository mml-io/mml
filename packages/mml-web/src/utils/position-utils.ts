import { TransformableElement } from "../elements";
import { EulXYZ } from "../math/Eul";
import { Matr4 } from "../math/Matr4";
import { Quat } from "../math/Quat";
import { Vect3 } from "../math/Vect3";
import { PositionAndRotation } from "../MMLScene";

const tempContainerMatrix = new Matr4();
const tempTargetMatrix = new Matr4();
const tempPositionVector = new Vect3();
const tempRotationEuler = new EulXYZ();
const tempRotationQuaternion = new Quat();
const tempScaleVector = new Vect3();

export function getRelativePositionAndRotationRelativeToObject(
  positionAndRotation: PositionAndRotation,
  container: TransformableElement,
): PositionAndRotation {
  const { x, y, z } = positionAndRotation.position;
  const { x: rx, y: ry, z: rz } = positionAndRotation.rotation;

  tempContainerMatrix.identity();
  const tempMatr4 = new Matr4();
  for (let obj: ParentNode | null = container; obj; obj = obj.parentNode) {
    if (obj instanceof TransformableElement) {
      obj.calculateLocalMatrix(tempMatr4);
      tempContainerMatrix.multiply(tempMatr4);
    }
  }

  tempContainerMatrix.invert();

  tempPositionVector.set(x, y, z);
  tempRotationEuler.set(rx, ry, rz);
  tempRotationQuaternion.setFromEulerXYZ(tempRotationEuler);
  tempScaleVector.set(1, 1, 1);
  tempTargetMatrix.compose(tempPositionVector, tempRotationQuaternion, tempScaleVector);

  tempTargetMatrix.premultiply(tempContainerMatrix);
  tempTargetMatrix.decompose(tempPositionVector, tempRotationQuaternion, tempScaleVector);
  tempRotationEuler.setFromQuaternion(tempRotationQuaternion);

  return {
    position: {
      x: tempPositionVector.x,
      y: tempPositionVector.y,
      z: tempPositionVector.z,
    },
    rotation: {
      x: tempRotationEuler.x,
      y: tempRotationEuler.y,
      z: tempRotationEuler.z,
    },
  };
}
