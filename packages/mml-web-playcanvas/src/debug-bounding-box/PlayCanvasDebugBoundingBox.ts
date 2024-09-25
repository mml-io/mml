import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

export function createPlayCanvasDebugBoundingBox(
  graphicsAdapter: PlayCanvasGraphicsAdapter,
  material: playcanvas.Material,
): playcanvas.Entity {
  const entity = new playcanvas.Entity(
    "position-probe-internal",
    graphicsAdapter.getPlayCanvasApp(),
  );
  entity.addComponent("model", {
    type: "box",
    material,
  });
  entity.model?.model.meshInstances.forEach((mi) => {
    mi.renderStyle = playcanvas.RENDERSTYLE_WIREFRAME;
    mi.castShadow = false;
  });
  return entity;
}
