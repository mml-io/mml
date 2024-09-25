import { Interaction } from "mml-web";
import { InteractionGraphics } from "mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

export class PlayCanvasInteraction extends InteractionGraphics<PlayCanvasGraphicsAdapter> {
  private entity: playcanvas.Entity | null = null;
  private debugMaterial: playcanvas.BasicMaterial | null = null;

  constructor(private positionProbe: Interaction<PlayCanvasGraphicsAdapter>) {
    super(positionProbe);
    this.updateDebugVisualisation();
  }

  disable(): void {}

  enable(): void {}

  public setRange(): void {
    this.updateDebugVisualisation();
  }

  public setInFocus(): void {
    // no-op
  }

  public setLineOfSight(): void {
    // no-op
  }

  public setPriority(): void {
    // no-op
  }

  public setPrompt(): void {
    // no-op
  }

  public setDebug() {
    this.updateDebugVisualisation();
  }

  private clearDebugVisualisation() {
    if (this.entity) {
      this.entity.destroy();
      this.entity = null;
    }
    if (this.debugMaterial) {
      this.debugMaterial.destroy();
      this.debugMaterial = null;
    }
  }

  private updateDebugVisualisation() {
    if (!this.positionProbe.props.debug) {
      this.clearDebugVisualisation();
    } else {
      if (this.positionProbe.isConnected && !this.entity) {
        this.entity = new playcanvas.Entity(
          "position-probe-internal",
          this.positionProbe.getScene().getGraphicsAdapter().getPlayCanvasApp(),
        );
        if (!this.debugMaterial) {
          this.debugMaterial = new playcanvas.BasicMaterial();
          this.debugMaterial.color = new playcanvas.Color(0, 1, 0);
        }
        this.entity.addComponent("model", {
          type: "sphere",
          material: this.debugMaterial,
        });
        this.entity.model?.model.meshInstances.forEach((mi) => {
          mi.renderStyle = playcanvas.RENDERSTYLE_WIREFRAME;
          mi.castShadow = false;
        });

        this.positionProbe.getContainer().addChild(this.entity);
      }

      if (this.entity) {
        this.entity.setLocalScale(
          this.positionProbe.props.range * 2,
          this.positionProbe.props.range * 2,
          this.positionProbe.props.range * 2,
        );
      }
    }
  }

  dispose() {
    this.clearDebugVisualisation();
  }
}
