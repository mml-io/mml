import * as playcanvas from "playcanvas";

import { PlayCanvasCube } from "./PlayCanvasCube";
import { PlayCanvasCylinder } from "./PlayCanvasCylinder";
import { PlayCanvasLight } from "./PlayCanvasLight";
import { PlayCanvasMElement } from "./PlayCanvasMElement";
import { PlayCanvasModel } from "./PlayCanvasModel";
import { PlayCanvasPlane } from "./PlayCanvasPlane";
import { PlayCanvasRemoteDocument } from "./PlayCanvasRemoteDocument";
import { PlayCanvasSphere } from "./PlayCanvasSphere";
import { PlayCanvasTransformable } from "./PlayCanvasTransformable";
import { MMLGraphicsInterface } from "../MMLGraphicsInterface";

export const PlayCanvasGraphicsInterface: MMLGraphicsInterface<playcanvas.Entity> = {
  MElementGraphicsInterface: PlayCanvasMElement,
  MMLCubeGraphicsInterface: PlayCanvasCube,
  MMLSphereGraphicsInterface: PlayCanvasSphere,
  MMLCylinderGraphicsInterface: PlayCanvasCylinder,
  MMLPlaneGraphicsInterface: PlayCanvasPlane,
  MMLTransformableGraphicsInterface: PlayCanvasTransformable,
  RemoteDocumentGraphicsInterface: PlayCanvasRemoteDocument,
  MMLLightGraphicsInterface: PlayCanvasLight,
  MMLModelGraphicsInterface: PlayCanvasModel,
};
