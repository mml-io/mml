import * as THREE from "three";

import { Interaction, MElement } from "../elements";
import { IMMLScene } from "../MMLScene";

const focusBoundsScaleMatrix = new THREE.Matrix4().makeScale(0.5, 0.5, 0.5);
const raycaster = new THREE.Raycaster();
const intersections = new Array<THREE.Intersection<THREE.Object3D>>();
const direction = new THREE.Vector3();

const frustum = new THREE.Frustum();
const matrix = new THREE.Matrix4();
const pos = new THREE.Vector3();

export class InteractionUtils {
  static getRelevantInteractions(
    scene: IMMLScene,
    interactions: Set<Interaction>,
  ): Array<Interaction> {
    const relevantInteractions = new Array<Interaction>();

    const camera = scene.getCamera();
    const userLocation = scene.getUserPosition().location;
    const position = new THREE.Vector3();
    position.set(userLocation.x, userLocation.y, userLocation.z);

    // TODO: make this more performant (don't check ALL interactions every time)
    interactions.forEach((int: Interaction) => {
      if (InteractionUtils.isRelevant(int, position, camera, scene)) {
        relevantInteractions.push(int);
      }
    });
    return relevantInteractions;
  }

  static getRaycastResults(
    a: THREE.Vector3,
    b: THREE.Vector3,
    distance: number,
    rootObject: THREE.Object3D,
  ) {
    direction.copy(b);
    direction.sub(a);
    direction.normalize();

    raycaster.set(a, direction);
    raycaster.near = 0;
    raycaster.far = distance;

    intersections.length = 0;
    raycaster.intersectObject(rootObject, true, intersections);
    return intersections;
  }

  static getCameraFrustum(camera: THREE.Camera) {
    matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);
    return frustum;
  }

  static getInteractionWorldPosition(int: Interaction): THREE.Vector3 {
    int.getContainer().getWorldPosition(pos);
    return pos;
  }

  static isRelevant(
    int: Interaction,
    origin: THREE.Vector3,
    camera: THREE.Camera,
    scene: IMMLScene,
  ): boolean {
    let distanceToOrigin: number | null = null;

    const rangeAttr = int.getAttribute("range");
    if (rangeAttr) {
      // filter on distance from position
      distanceToOrigin ??= origin.distanceTo(InteractionUtils.getInteractionWorldPosition(int));
      if (distanceToOrigin > parseFloat(rangeAttr)) {
        return false;
      }
    }

    const focusAttr = int.getAttribute("in-focus");
    if (focusAttr && focusAttr === "true") {
      // check to see if the interaction's parent bounds overlap with the frustum
      const parent = int.getContainer().parent;
      if (!parent) {
        return false;
      }

      const parentElement = MElement.getMElementFromObject(parent);
      const interactionBounds = parentElement?.getBounds();
      if (interactionBounds) {
        // check collision with bounds that have been slightly shrunk, to avoid
        // interactions whose edge is only just visible
        if (
          !InteractionUtils.getCameraFrustum(camera).intersectsBox(
            interactionBounds.applyMatrix4(focusBoundsScaleMatrix),
          )
        ) {
          return false;
        }
      }
    }

    // is there a line of sight between the user's position and the interactable element?
    const losAttr = int.getAttribute("line-of-sight");
    if (losAttr && losAttr === "true") {
      // check to see if anything that is not a child object of the interaction's
      // parent is blocking a ray between the interaction and the user position
      const parent = int.getContainer().parent;
      if (!parent) {
        return false;
      }

      // perform a raycast
      const interactablePosition = InteractionUtils.getInteractionWorldPosition(int);
      distanceToOrigin ??= origin.distanceTo(interactablePosition);

      const intersections = InteractionUtils.getRaycastResults(
        origin,
        interactablePosition,
        distanceToOrigin,
        scene.getRootContainer(),
      );

      if (intersections.length > 0) {
        // check that no objects are blocking
        return !intersections.some(function blocks(intersection: THREE.Intersection) {
          const { object: intersectedObject } = intersection;
          if (!intersectedObject.visible) return false;
          let commonParent = intersectedObject.parent;
          while (commonParent) {
            // we don't block ourselves
            if (commonParent === parent) return false;
            commonParent = commonParent.parent;
          }
          // this intersected object blocks line of sight
          return true;
        });
      }
    }
    return true;
  }
}
