import { MElement, MMLColor, PointLightHelperVisualizerGraphics } from "@mml-io/mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

const POINT_LIGHT_HELPER_SIZE = 0.25;

function mmlColorToThree(color: MMLColor): THREE.Color {
  return new THREE.Color(color.r, color.g, color.b);
}

/**
 * ThreeJS point light helper visualizer (range sphere + center marker).
 */
export class ThreeJSPointLightHelperVisualizer extends PointLightHelperVisualizerGraphics<ThreeJSGraphicsAdapter> {
  private helper: THREE.Object3D;
  private currentDistance: number | null;
  private currentColor: MMLColor;

  constructor(element: MElement<ThreeJSGraphicsAdapter>, distance: number | null, color: MMLColor) {
    super(element, distance, color);
    this.currentDistance = distance;
    this.currentColor = color;
    const radius = distance ?? 10;
    const geometry = new THREE.SphereGeometry(radius, 16, 12);
    const material = new THREE.MeshBasicMaterial({
      color: mmlColorToThree(color),
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    this.helper = new THREE.Mesh(geometry, material);

    const centerGeometry = new THREE.SphereGeometry(POINT_LIGHT_HELPER_SIZE, 8, 6);
    const centerMaterial = new THREE.MeshBasicMaterial({
      color: mmlColorToThree(color),
    });
    const center = new THREE.Mesh(centerGeometry, centerMaterial);
    this.helper.add(center);
    this.element.getContainer().add(this.helper);
  }

  getContainer(): THREE.Object3D {
    return this.helper;
  }

  setSelected(_selected: boolean): void {
    // selection handled by parent visualizer controller
  }

  setVisible(visible: boolean): void {
    this.helper.visible = visible;
  }

  setDistance(distance: number | null): void {
    this.currentDistance = distance;
    this.update(this.currentDistance, this.currentColor);
  }

  setColor(color: MMLColor): void {
    this.currentColor = color;
    this.update(this.currentDistance, this.currentColor);
  }

  update(distance: number | null, color: MMLColor): void {
    const mesh = this.helper as THREE.Mesh;
    const material = mesh.material as THREE.MeshBasicMaterial;
    material.color = mmlColorToThree(color);

    const newRadius = distance ?? 10;
    mesh.geometry.dispose();
    mesh.geometry = new THREE.SphereGeometry(newRadius, 16, 12);
  }

  dispose(): void {
    this.helper.removeFromParent();
    const mesh = this.helper as THREE.Mesh;
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    this.helper.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }
}

