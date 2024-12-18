import { CanvasText } from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

function createReconnectingStatus(playCanvasApp: playcanvas.AppBase): PlayCanvasReconnectingStatus {
  const canvas = new CanvasText().renderText("Reconnecting", {
    bold: true,
    fontSize: 32,
    paddingPx: 10,
    textColorRGB255A1: {
      r: 255,
      g: 0,
      b: 0,
      a: 1.0,
    },
    backgroundColorRGB255A1: {
      r: 255,
      g: 255,
      b: 255,
      a: 1.0,
    },
    alignment: "center",
  });

  const texture = new playcanvas.Texture(playCanvasApp.graphicsDevice, {
    width: canvas.width,
    height: canvas.height,
  });
  texture.setSource(canvas);

  const material = new playcanvas.StandardMaterial();
  material.useLighting = false;
  material.emissiveMap = texture;
  material.update();

  texture.destroy();

  const width = canvas.width;
  const height = canvas.height;

  return { material, width: width / 100, height: height / 100 };
}

export type PlayCanvasReconnectingStatus = {
  material: playcanvas.StandardMaterial;
  width: number;
  height: number;
};

let reconnectingStatus: PlayCanvasReconnectingStatus | null = null;

export function getPlayCanvasReconnectingStatus(
  playCanvasApp: playcanvas.AppBase,
): PlayCanvasReconnectingStatus {
  if (!reconnectingStatus) {
    reconnectingStatus = createReconnectingStatus(playCanvasApp);
  }
  return reconnectingStatus;
}
