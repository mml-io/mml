import * as playcanvas from "playcanvas";

import { PlayCanvasAudio } from "./PlayCanvasAudio";
import { PlayCanvasCube } from "./PlayCanvasCube";
import { PlayCanvasCylinder } from "./PlayCanvasCylinder";
import { PlayCanvasDebugHelper } from "./PlayCanvasDebugHelper";
import { PlayCanvasImage } from "./PlayCanvasImage";
import { PlayCanvasLight } from "./PlayCanvasLight";
import { PlayCanvasMElement } from "./PlayCanvasMElement";
import { PlayCanvasModel } from "./PlayCanvasModel";
import { PlayCanvasPlane } from "./PlayCanvasPlane";
import { PlayCanvasRemoteDocument } from "./PlayCanvasRemoteDocument";
import { PlayCanvasSphere } from "./PlayCanvasSphere";
import { PlayCanvasTransformable } from "./PlayCanvasTransformable";
import { MMLGraphicsInterface } from "../MMLGraphicsInterface";

export const PlayCanvasGraphicsInterface: MMLGraphicsInterface<playcanvas.Entity> = {
  MMLDebugHelperGraphicsInterface: PlayCanvasDebugHelper,
  MElementGraphicsInterface: PlayCanvasMElement,
  MMLCubeGraphicsInterface: PlayCanvasCube,
  MMLSphereGraphicsInterface: PlayCanvasSphere,
  MMLCylinderGraphicsInterface: PlayCanvasCylinder,
  MMLImageGraphicsInterface: PlayCanvasImage,
  MMLAudioGraphicsInterface: PlayCanvasAudio,
  MMLPlaneGraphicsInterface: PlayCanvasPlane,
  MMLTransformableGraphicsInterface: PlayCanvasTransformable,
  RemoteDocumentGraphicsInterface: PlayCanvasRemoteDocument,
  MMLLightGraphicsInterface: PlayCanvasLight,
  MMLModelGraphicsInterface: PlayCanvasModel,
};
