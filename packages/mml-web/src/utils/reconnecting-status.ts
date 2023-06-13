import * as THREE from "three";

import { THREECanvasTextTexture } from "./CanvasText";

function createReconnectingStatus() {
  const { texture, width, height } = THREECanvasTextTexture("Reconnecting...", {
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
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
  });
  const geometry = new THREE.PlaneGeometry(width / 100, height / 100, 1, 1);
  return { geometry, material, width: width / 100, height: height / 100 };
}

export type ReconnectingStatus = {
  geometry: THREE.PlaneGeometry;
  material: THREE.MeshBasicMaterial;
  width: number;
  height: number;
};

let reconnectingStatus: ReconnectingStatus | null = null;

export function getReconnectingStatus(): ReconnectingStatus {
  if (!reconnectingStatus) {
    reconnectingStatus = createReconnectingStatus();
  }
  return reconnectingStatus;
}
