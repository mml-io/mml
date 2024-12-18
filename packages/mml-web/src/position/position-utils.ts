import { MElement, TransformableElement } from "../elements";
import { GraphicsAdapter } from "../graphics";
import { degToRad, EulXYZ, Matr4, Quat, radToDeg, Vect3 } from "../math";
import { PositionAndRotation } from "../scene";

const tempContainerMatrix = new Matr4();
const tempTargetMatrix = new Matr4();
const tempPositionVector = new Vect3();
const tempRotationEuler = new EulXYZ();
const tempRotationQuaternion = new Quat();
const tempScaleVector = new Vect3();

export function getRelativePositionAndRotationRelativeToObject(
  positionAndRotation: PositionAndRotation,
  container: MElement<GraphicsAdapter>,
): PositionAndRotation {
  const { x, y, z } = positionAndRotation.position;

  // Rotation in degrees
  const { x: rx, y: ry, z: rz } = positionAndRotation.rotation;

  tempContainerMatrix.identity();
  const tempMatr4 = new Matr4();
  for (let obj: ParentNode | null = container; obj; obj = obj.parentNode) {
    if (obj instanceof TransformableElement) {
      obj.calculateLocalMatrix(tempMatr4);
      tempContainerMatrix.premultiply(tempMatr4);
    }
  }

  tempContainerMatrix.invert();

  tempPositionVector.set(x, y, z);
  tempRotationEuler.set(degToRad(rx), degToRad(ry), degToRad(rz));
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
      x: radToDeg(tempRotationEuler.x),
      y: radToDeg(tempRotationEuler.y),
      z: radToDeg(tempRotationEuler.z),
    },
  };
}
