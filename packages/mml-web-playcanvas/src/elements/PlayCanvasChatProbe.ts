import { ChatProbe, ChatProbeGraphics } from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { BasicMaterial } from "../helpers/BasicMaterialPolyfill";
import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

export class PlayCanvasChatProbe extends ChatProbeGraphics<PlayCanvasGraphicsAdapter> {
  private entity: playcanvas.Entity | null = null;
  private debugMaterial: BasicMaterial | null = null;

  constructor(private chatProbe: ChatProbe<PlayCanvasGraphicsAdapter>) {
    super(chatProbe);
    this.updateDebugVisualisation();
  }

  public disable(): void {}

  public enable(): void {}

  public setRange(): void {
    this.updateDebugVisualisation();
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
    if (!this.chatProbe.props.debug) {
      this.clearDebugVisualisation();
    } else {
      if (this.chatProbe.isConnected && !this.entity) {
        this.entity = new playcanvas.Entity(
          "chat-probe-internal",
          this.chatProbe.getScene().getGraphicsAdapter().getPlayCanvasApp(),
        );
        if (!this.debugMaterial) {
          this.debugMaterial = new BasicMaterial();
          this.debugMaterial.color = new playcanvas.Color(1, 1, 0);
        }
        this.entity.addComponent("model", {
          type: "sphere",
          material: this.debugMaterial,
        });
        this.entity.model?.model?.meshInstances.forEach((mi) => {
          mi.renderStyle = playcanvas.RENDERSTYLE_WIREFRAME;
          mi.castShadow = false;
        });

        this.chatProbe.getContainer().addChild(this.entity);
      }

      if (this.entity) {
        this.entity.setLocalScale(
          this.chatProbe.props.range * 2,
          this.chatProbe.props.range * 2,
          this.chatProbe.props.range * 2,
        );
      }
    }
  }

  public dispose() {
    this.clearDebugVisualisation();
  }
}
