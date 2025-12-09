import {
  ElementVisualizer,
  MElement,
  MMLColor,
  SpotLightHelperVisualizerGraphics,
  VisualizerOptions,
} from "@mml-io/mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

function mmlColorToThree(color: MMLColor): THREE.Color {
  return new THREE.Color(color.r, color.g, color.b);
}

/**
 * ThreeJS spot light helper visualizer (cone + center line).
 */
export class ThreeJSSpotLightHelperVisualizer
  extends SpotLightHelperVisualizerGraphics<ThreeJSGraphicsAdapter>
  implements ElementVisualizer<ThreeJSGraphicsAdapter>
{
  private helper: THREE.Object3D;
  private currentAngle: number;
  private currentDistance: number | null;
  private currentColor: MMLColor;

  constructor(
    element: MElement<ThreeJSGraphicsAdapter>,
    angleDeg: number,
    distance: number | null,
    color: MMLColor,
    options?: VisualizerOptions,
  ) {
    super(element, angleDeg, distance, color, options);
    this.currentAngle = angleDeg;
    this.currentDistance = distance;
    this.currentColor = color;
    this.helper = new THREE.Object3D();
    this.createCone(angleDeg, distance, color);
    this.helper.userData.visualizerClickable = this.isClickable();
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

  setAngle(angleDeg: number): void {
    this.currentAngle = angleDeg;
    this.update(this.currentAngle, this.currentDistance, this.currentColor);
  }

  setDistance(distance: number | null): void {
    this.currentDistance = distance;
    this.update(this.currentAngle, this.currentDistance, this.currentColor);
  }

  setColor(color: MMLColor): void {
    this.currentColor = color;
    this.update(this.currentAngle, this.currentDistance, this.currentColor);
  }

  update(angleDeg: number, distance: number | null, color: MMLColor): void {
    this.createCone(angleDeg, distance, color);
  }

  dispose(): void {
    this.helper.removeFromParent();
    this.helper.children.forEach((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m: THREE.Material) => m.dispose());
        } else {
          (child.material as THREE.Material)?.dispose();
        }
      }
    });
  }

  private createCone(angleDeg: number, distance: number | null, color: MMLColor): void {
    while (this.helper.children.length > 0) {
      const child = this.helper.children[0];
      this.helper.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m: THREE.Material) => m.dispose());
        } else {
          (child.material as THREE.Material)?.dispose();
        }
      }
    }

    const length = distance ?? 10;
    const angleRad = THREE.MathUtils.degToRad(angleDeg);
    const radius = Math.tan(angleRad) * length;
    const threeColor = mmlColorToThree(color);

    const geometry = new THREE.ConeGeometry(radius, length, 16, 1, true);
    const material = new THREE.MeshBasicMaterial({
      color: threeColor,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const cone = new THREE.Mesh(geometry, material);
    cone.position.y = -length / 2;
    this.helper.add(cone);

    const lineMaterial = new THREE.LineBasicMaterial({
      color: mmlColorToThree(color),
      transparent: true,
      opacity: 0.5,
    });
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -length, 0),
    ]);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    this.helper.add(line);
  }
}

