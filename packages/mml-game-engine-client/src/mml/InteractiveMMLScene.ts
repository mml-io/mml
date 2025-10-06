import { MElement, MMLScene } from "@mml-io/mml-web";
import { Group } from "three";

import { GameThreeJSAdapter } from "./GameThreeJSAdapter";

export class InteractiveMMLScene extends MMLScene<GameThreeJSAdapter> {
  public addCollider(collider: unknown, element: MElement<GameThreeJSAdapter>): void {
    if (!this.hasGraphicsAdapter()) {
      return;
    }
    this.getGraphicsAdapter()
      .getCollisionsManager()
      .addMeshesGroup(collider as Group, element);
  }

  public updateCollider(collider: unknown): void {
    if (!this.hasGraphicsAdapter()) {
      return;
    }
    this.getGraphicsAdapter()
      .getCollisionsManager()
      .updateMeshesGroup(collider as Group);
  }

  public removeCollider(collider: unknown): void {
    if (!this.hasGraphicsAdapter()) {
      return;
    }
    this.getGraphicsAdapter()
      .getCollisionsManager()
      .removeMeshesGroup(collider as Group);
  }
}
