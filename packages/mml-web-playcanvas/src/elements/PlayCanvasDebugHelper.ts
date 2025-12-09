import { DebugHelper, DebugHelperGraphics } from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { createPlayCanvasDebugBoundingBox } from "../debug-bounding-box/PlayCanvasDebugBoundingBox";
import { BasicMaterial } from "../helpers/BasicMaterialPolyfill";
import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

export class PlayCanvasDebugHelper extends DebugHelperGraphics<PlayCanvasGraphicsAdapter> {
  private debugAxes: playcanvas.Entity | null = null;

  constructor(private debugHelper: DebugHelper<PlayCanvasGraphicsAdapter>) {
    super(debugHelper);

    const graphicsAdapter = this.debugHelper.element.getScene().getGraphicsAdapter();

    const playcanvasApp = graphicsAdapter.getPlayCanvasApp();

    const playcanvasEntity: playcanvas.Entity = this.debugHelper.getContainer();
    this.debugAxes = new playcanvas.Entity("axes", playcanvasApp);
    playcanvasEntity.addChild(this.debugAxes);

    const xMaterial = new BasicMaterial();
    xMaterial.color = new playcanvas.Color(1, 0, 0);
    const xAxis = createPlayCanvasDebugBoundingBox(graphicsAdapter, xMaterial);
    xAxis.setLocalScale(0.5, 0, 0);
    xAxis.setLocalPosition(0.25, 0, 0);
    this.debugAxes.addChild(xAxis);

    const yMaterial = new BasicMaterial();
    yMaterial.color = new playcanvas.Color(0, 1, 0);
    const yAxis = createPlayCanvasDebugBoundingBox(graphicsAdapter, yMaterial);
    yAxis.setLocalScale(0, 0.5, 0);
    yAxis.setLocalPosition(0, 0.25, 0);
    this.debugAxes.addChild(yAxis);

    const zMaterial = new BasicMaterial();
    zMaterial.color = new playcanvas.Color(0, 0, 1);
    const zAxis = createPlayCanvasDebugBoundingBox(graphicsAdapter, zMaterial);
    zAxis.setLocalScale(0, 0, 0.5);
    zAxis.setLocalPosition(0, 0, 0.25);
    this.debugAxes.addChild(zAxis);
  }

  dispose() {
    if (this.debugAxes) {
      this.debugHelper.getContainer().removeChild(this.debugAxes);
      this.debugAxes.destroy();
    }
    this.debugAxes = null;
  }
}
