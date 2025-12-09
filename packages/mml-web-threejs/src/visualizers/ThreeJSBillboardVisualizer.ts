import { BillboardVisualizerGraphics, MElement, MMLColor, VisualizerOptions } from "@mml-io/mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

function createSvgBillboard(svgContent: string, size: number, color?: MMLColor): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const resolution = 128;
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext("2d")!;

  let processedSvg = svgContent;
  if (color) {
    const hexColor = `#${Math.round(color.r * 255)
      .toString(16)
      .padStart(2, "0")}${Math.round(color.g * 255)
      .toString(16)
      .padStart(2, "0")}${Math.round(color.b * 255)
      .toString(16)
      .padStart(2, "0")}`;
    processedSvg = svgContent.replace(/currentColor/g, hexColor);
  }

  const img = new Image();
  const svgBlob = new Blob([processedSvg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svgBlob);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);

  img.onload = () => {
    ctx.clearRect(0, 0, resolution, resolution);
    ctx.drawImage(img, 0, 0, resolution, resolution);
    texture.needsUpdate = true;
    URL.revokeObjectURL(url);
  };
  img.src = url;

  return sprite;
}

/**
 * ThreeJS billboard visualizer implementation.
 */
export class ThreeJSBillboardVisualizer extends BillboardVisualizerGraphics<ThreeJSGraphicsAdapter> {
  private sprite: THREE.Sprite;

  constructor(
    element: MElement<ThreeJSGraphicsAdapter>,
    svgContent: string,
    size: number,
    color?: MMLColor,
    options?: VisualizerOptions,
  ) {
    super(element, svgContent, size, color, options);
    this.sprite = createSvgBillboard(this.svgContent, this.size, this.color);
    this.sprite.userData.visualizerClickable = this.isClickable();
    this.element.getContainer().add(this.sprite);
  }

  setVisible(visible: boolean): void {
    this.sprite.visible = visible;
  }

  setSvgContent(svgContent: string): void {
    this.svgContent = svgContent;
    this.sprite = createSvgBillboard(this.svgContent, this.size, this.color);
  }

  setSize(size: number): void {
    this.size = size;
    this.sprite.scale.set(size, size, 1);
  }

  setColor(color: MMLColor): void {
    this.color = color;
    this.sprite.material.color = new THREE.Color(color.r, color.g, color.b);
  }

  enable(): void {
    this.sprite.visible = true;
  }

  disable(): void {
    this.sprite.visible = false;
  }

  dispose(): void {
    this.sprite.removeFromParent();
    this.sprite.material.dispose();
    if (this.sprite.material.map) {
      this.sprite.material.map.dispose();
    }
  }
}

