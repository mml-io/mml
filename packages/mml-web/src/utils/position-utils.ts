import * as THREE from "three";

import { PositionAndRotation } from "../MMLScene";

const tempContainerMatrix = new THREE.Matrix4();
const tempTargetMatrix = new THREE.Matrix4();
const tempPositionVector = new THREE.Vector3();
const tempRotationEuler = new THREE.Euler();
const tempRotationQuaternion = new THREE.Quaternion();
const tempScaleVector = new THREE.Vector3();

export function getRelativePositionAndRotationRelativeToObject(
  positionAndRotation: PositionAndRotation,
  container: THREE.Object3D,
): PositionAndRotation {
  const { x, y, z } = positionAndRotation.position;
  const { x: rx, y: ry, z: rz } = positionAndRotation.rotation;

  tempContainerMatrix.copy(container.matrixWorld).invert();

  tempPositionVector.set(x, y, z);
  tempRotationEuler.set(rx, ry, rz);
  tempRotationQuaternion.setFromEuler(tempRotationEuler);
  tempScaleVector.set(1, 1, 1);

  tempTargetMatrix.compose(tempPositionVector, tempRotationQuaternion, tempScaleVector);
  tempTargetMatrix.premultiply(tempContainerMatrix);
  tempTargetMatrix.decompose(tempPositionVector, tempRotationQuaternion, tempScaleVector);

  tempRotationEuler.setFromQuaternion(tempRotationQuaternion);

  // Correct for the container's local scale
  tempPositionVector.multiply(container.scale);

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
