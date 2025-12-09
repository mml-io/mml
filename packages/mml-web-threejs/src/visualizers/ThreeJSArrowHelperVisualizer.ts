import {
  ArrowHelperVisualizerGraphics,
  ElementVisualizer,
  MElement,
  MMLColor,
  VisualizerOptions,
} from "@mml-io/mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

const DEFAULT_ARROW_LENGTH = 2;

function mmlColorToThree(color: MMLColor): THREE.Color {
  return new THREE.Color(color.r, color.g, color.b);
}

/**
 * ThreeJS arrow helper visualizer used to indicate light direction.
 */
export class ThreeJSArrowHelperVisualizer
  extends ArrowHelperVisualizerGraphics<ThreeJSGraphicsAdapter>
  implements ElementVisualizer<ThreeJSGraphicsAdapter>
{
  private helper: THREE.Object3D;
  private arrowGroup: THREE.Group;
  private arrowHead: THREE.Mesh;
  private arrowStem: THREE.Mesh;
  private arrowMaterial: THREE.MeshBasicMaterial;
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
    this.helper = new THREE.Object3D();

    const { group, head, stem, material } = this.createArrow(distance, color);
    this.arrowGroup = group;
    this.arrowHead = head;
    this.arrowStem = stem;
    this.arrowMaterial = material;
    this.helper.add(this.arrowGroup);
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
    this.updateArrow(distance, this.currentColor);
  }

  setColor(color: MMLColor): void {
    this.currentColor = color;
    this.updateArrow(this.currentDistance, this.currentColor);
  }

  dispose(): void {
    this.helper.removeFromParent();
    this.arrowHead.geometry.dispose();
    this.arrowStem.geometry.dispose();
    this.arrowMaterial.dispose();
  }

  private updateArrow(distance: number | null, color: MMLColor): void {
    const { headGeometry, stemGeometry, headOffsetY, stemOffsetY } = this.buildArrowGeometry(distance);

    this.arrowHead.geometry.dispose();
    this.arrowHead.geometry = headGeometry;
    this.arrowHead.position.set(0, headOffsetY, 0);

    this.arrowStem.geometry.dispose();
    this.arrowStem.geometry = stemGeometry;
    this.arrowStem.position.set(0, stemOffsetY, 0);

    this.arrowMaterial.color = mmlColorToThree(color);
  }

  private createArrow(
    distance: number | null,
    color: MMLColor,
  ): {
    group: THREE.Group;
    head: THREE.Mesh;
    stem: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
  } {
    const { headGeometry, stemGeometry, headOffsetY, stemOffsetY } = this.buildArrowGeometry(distance);
    const material = new THREE.MeshBasicMaterial({
      color: mmlColorToThree(color),
      transparent: true,
      opacity: 0.7,
    });

    const head = new THREE.Mesh(headGeometry, material);
    head.position.set(0, headOffsetY, 0);
    head.rotation.set(Math.PI, 0, 0);

    const stem = new THREE.Mesh(stemGeometry, material);
    stem.position.set(0, stemOffsetY, 0);

    const group = new THREE.Group();
    group.add(stem, head);

    return { group, head, stem, material };
  }

  private buildArrowGeometry(
    distance: number | null,
  ): {
    headGeometry: THREE.ConeGeometry;
    stemGeometry: THREE.CylinderGeometry;
    headOffsetY: number;
    stemOffsetY: number;
  } {
    const length = distance ?? DEFAULT_ARROW_LENGTH;
    const arrowHeadLength = Math.max(Math.min(length * 0.2, 1.5), 0.3);
    const arrowHeadRadius = arrowHeadLength * 0.35;
    const stemLength = Math.max(length - arrowHeadLength, 0.1);
    const stemRadius = Math.max(arrowHeadRadius * 0.35, 0.02);

    const headGeometry = new THREE.ConeGeometry(arrowHeadRadius, arrowHeadLength, 12);

    const stemGeometry = new THREE.CylinderGeometry(stemRadius, stemRadius, stemLength, 10);

    const headOffsetY = -(stemLength + arrowHeadLength / 2);
    const stemOffsetY = -stemLength / 2;

    return { headGeometry, stemGeometry, headOffsetY, stemOffsetY };
  }
}


