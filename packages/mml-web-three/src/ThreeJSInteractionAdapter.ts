import { Interaction } from "mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "./ThreeJSGraphicsAdapter";

export class ThreeJSInteractionAdapter {
  private static worldPos = new THREE.Vector3();

  private static matrix = new THREE.Matrix4();
  private static frustum = new THREE.Frustum();

  private static raycaster = new THREE.Raycaster();
  private static intersections = new Array<THREE.Intersection<THREE.Object3D>>();
  private static direction = new THREE.Vector3();

  static interactionShouldShowDistance(
    interaction: Interaction<ThreeJSGraphicsAdapter>,
    camera: THREE.Camera,
    scene: THREE.Scene,
  ): number | null {
    const worldPos = interaction
      .getContainer()
      .getWorldPosition(ThreeJSInteractionAdapter.worldPos);

    const cameraPos = camera.position;
    const distance = cameraPos.distanceTo(worldPos);
    if (distance > interaction.props.range) {
      return null;
    }

    if (interaction.props.inFocus) {
      ThreeJSInteractionAdapter.matrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      );
      ThreeJSInteractionAdapter.frustum.setFromProjectionMatrix(ThreeJSInteractionAdapter.matrix);
      if (!ThreeJSInteractionAdapter.frustum.containsPoint(worldPos)) {
        return null;
      }
    }

    if (interaction.props.lineOfSight) {
      const raycastResults = ThreeJSInteractionAdapter.getRaycastResults(
        cameraPos,
        worldPos,
        distance,
        scene,
      );
      if (raycastResults.length > 0) {
        for (const result of raycastResults) {
          if (!ThreeJSInteractionAdapter.hasAncestor(result.object, interaction.getContainer())) {
            return null;
          }
        }
      }
    }

    return distance;
  }

  static getRaycastResults(
    a: THREE.Vector3,
    b: THREE.Vector3,
    distance: number,
    scene: THREE.Scene,
  ) {
    ThreeJSInteractionAdapter.direction.copy(b);
    ThreeJSInteractionAdapter.direction.sub(a);
    ThreeJSInteractionAdapter.direction.normalize();

    ThreeJSInteractionAdapter.raycaster.set(a, ThreeJSInteractionAdapter.direction);
    ThreeJSInteractionAdapter.raycaster.near = 0;
    ThreeJSInteractionAdapter.raycaster.far = distance;

    ThreeJSInteractionAdapter.intersections.length = 0;
    ThreeJSInteractionAdapter.raycaster.intersectObject(
      scene,
      true,
      ThreeJSInteractionAdapter.intersections,
    );
    return ThreeJSInteractionAdapter.intersections;
  }

  static hasAncestor(object: THREE.Object3D, ancestor: THREE.Object3D): boolean {
    let parent = object.parent;
    while (parent !== null) {
      if (parent === ancestor) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }
}
