import { GraphicsAdapter } from "mml-web";
import * as playcanvas from "playcanvas";

export type PlayCanvasGraphicsAdapter = GraphicsAdapter<
  playcanvas.Entity,
  playcanvas.Entity,
  playcanvas.Entity
> & {
  getPlayCanvasApp(): playcanvas.AppBase;
  getCamera(): playcanvas.Entity;
};
