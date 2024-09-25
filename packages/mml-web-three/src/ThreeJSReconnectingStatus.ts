import { CanvasText } from "mml-web";
import * as THREE from "three";

function createReconnectingStatus() {
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

  const texture = new THREE.Texture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.format = THREE.RGBAFormat;
  texture.needsUpdate = true;

  const width = canvas.width;
  const height = canvas.height;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
  });
  const geometry = new THREE.PlaneGeometry(width / 100, height / 100, 1, 1);
  return { geometry, material, width: width / 100, height: height / 100 };
}

export type ThreeJSReconnectingStatus = {
  geometry: THREE.PlaneGeometry;
  material: THREE.MeshBasicMaterial;
  width: number;
  height: number;
};

let reconnectingStatus: ThreeJSReconnectingStatus | null = null;

export function getThreeJSReconnectingStatus(): ThreeJSReconnectingStatus {
  if (!reconnectingStatus) {
    reconnectingStatus = createReconnectingStatus();
  }
  return reconnectingStatus;
}
