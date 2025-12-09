import {
  MElement,
  MMLColor,
  PointLightHelperVisualizerGraphics,
  VisualizerOptions,
} from "@mml-io/mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

const POINT_LIGHT_HELPER_SIZE = 0.25;

function mmlColorToThree(color: MMLColor): THREE.Color {
  return new THREE.Color(color.r, color.g, color.b);
}

/**
 * ThreeJS point light helper visualizer (perpendicular range circles + center marker).
 */
export class ThreeJSPointLightHelperVisualizer extends PointLightHelperVisualizerGraphics<ThreeJSGraphicsAdapter> {
  private helper: THREE.Object3D;
  private circleLines: THREE.Line[];
  private center: THREE.Mesh;
  private currentDistance: number | null;
  private currentColor: MMLColor;

  constructor(
    element: MElement<ThreeJSGraphicsAdapter>,
    distance: number | null,
    color: MMLColor,
    options?: VisualizerOptions,
  ) {
    super(element, distance, color, options);
    this.currentDistance = distance;
    this.currentColor = color;
    const radius = distance ?? 10;
    this.helper = new THREE.Object3D();

    const circleMaterialOne = new THREE.LineBasicMaterial({
      color: mmlColorToThree(color),
      transparent: true,
      opacity: 0.5,
    });
    const circleMaterialTwo = circleMaterialOne.clone();

    const circleOne = this.createCircleLine(radius, circleMaterialOne);
    const circleTwo = this.createCircleLine(radius, circleMaterialTwo);
    circleTwo.rotation.x = Math.PI / 2;

    this.circleLines = [circleOne, circleTwo];
    this.circleLines.forEach((line) => this.helper.add(line));

    const centerGeometry = new THREE.SphereGeometry(POINT_LIGHT_HELPER_SIZE, 8, 6);
    const centerMaterial = new THREE.MeshBasicMaterial({
      color: mmlColorToThree(color),
    });
    this.center = new THREE.Mesh(centerGeometry, centerMaterial);
    this.helper.add(this.center);
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

  setDistance(distance: number | null): void {
    this.currentDistance = distance;
    this.update(this.currentDistance, this.currentColor);
  }

  setColor(color: MMLColor): void {
    this.currentColor = color;
    this.update(this.currentDistance, this.currentColor);
  }

  update(distance: number | null, color: MMLColor): void {
    const newColor = mmlColorToThree(color);
    const newRadius = distance ?? 10;

    this.circleLines.forEach((line) => {
      const material = line.material as THREE.LineBasicMaterial;
      material.color = newColor;
      line.geometry.dispose();
      line.geometry = this.createCircleGeometry(newRadius);
    });

    const centerMaterial = this.center.material as THREE.MeshBasicMaterial;
    centerMaterial.color = newColor;
  }

  dispose(): void {
    this.helper.removeFromParent();
    this.circleLines.forEach((line) => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
    this.center.geometry.dispose();
    (this.center.material as THREE.Material).dispose();
  }

  private createCircleGeometry(radius: number): THREE.BufferGeometry {
    const segments = 48;
    const points = new THREE.Path().absarc(0, 0, radius, 0, Math.PI * 2).getSpacedPoints(segments);
    return new THREE.BufferGeometry().setFromPoints(points);
  }

  private createCircleLine(radius: number, material: THREE.LineBasicMaterial): THREE.Line {
    const geometry = this.createCircleGeometry(radius);
    return new THREE.LineLoop(geometry, material);
  }
}

