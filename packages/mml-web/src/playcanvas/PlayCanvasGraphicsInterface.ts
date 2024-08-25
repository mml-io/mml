import * as playcanvas from "playcanvas";

import { PlayCanvasCube } from "./PlayCanvasCube";
import { PlayCanvasLight } from "./PlayCanvasLight";
import { PlayCanvasMElement } from "./PlayCanvasMElement";
import { PlayCanvasModel } from "./PlayCanvasModel";
import { PlayCanvasRemoteDocument } from "./PlayCanvasRemoteDocument";
import { PlayCanvasTransformable } from "./PlayCanvasTransformable";
import { MMLGraphicsInterface } from "../MMLGraphicsInterface";

export const PlayCanvasGraphicsInterface: MMLGraphicsInterface<playcanvas.Entity> = {
  MElementGraphicsInterface: PlayCanvasMElement,
  MMLCubeGraphicsInterface: PlayCanvasCube,
  MMLTransformableGraphicsInterface: PlayCanvasTransformable,
  RemoteDocumentGraphicsInterface: PlayCanvasRemoteDocument,
  MMLLightGraphicsInterface: PlayCanvasLight,
  MMLModelGraphicsInterface: PlayCanvasModel,
};
