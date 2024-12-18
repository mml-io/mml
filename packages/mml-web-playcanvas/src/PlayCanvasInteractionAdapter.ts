import { Interaction } from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "./PlayCanvasGraphicsAdapter";

export class PlayCanvasInteractionAdapter {
  static interactionShouldShowDistance(
    interaction: Interaction<PlayCanvasGraphicsAdapter>,
    cameraEntity: playcanvas.Entity,
    cameraComponent: playcanvas.CameraComponent,
    app: playcanvas.AppBase,
  ): number | null {
    const worldPos = interaction.getContainer().getPosition();

    const cameraPos = cameraEntity.getPosition();
    const distance = cameraPos.distance(worldPos);
    if (distance > interaction.props.range) {
      return null;
    }

    if (interaction.props.inFocus) {
      if (!cameraComponent.frustum.containsPoint(worldPos)) {
        return null;
      }
    }

    if (interaction.props.lineOfSight) {
      const rigidbodySystem = app.systems.rigidbody;
      if (!rigidbodySystem) {
        console.warn("Rigidbody system not found. Line of sight check will not work.");
      } else {
        const raycastResults = rigidbodySystem.raycastAll(cameraPos, worldPos);
        if (raycastResults.length > 0) {
          for (const result of raycastResults) {
            if (
              !PlayCanvasInteractionAdapter.hasAncestor(result.entity, interaction.getContainer())
            ) {
              return null;
            }
          }
        }
      }
    }

    return distance;
  }

  static hasAncestor(object: playcanvas.Entity, ancestor: playcanvas.Entity): boolean {
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
