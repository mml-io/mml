import {
  calculateCapsuleGeometry,
  CharacterControllerPlaceholderConfig,
  DEFAULT_CHARACTER_CONTROLLER_PLACEHOLDER_CONFIG,
  extractCharacterControllerConfig,
  PlaceholderRenderer,
} from "@mml-io/mml-editor-core";
import { EditorGraphicsAdapter } from "@mml-io/mml-editor-core";
import { MElement } from "@mml-io/mml-web";
import { ThreeJSGraphicsAdapter } from "@mml-io/mml-web-threejs";
import * as THREE from "three";

/**
 * Character controller placeholder structure
 */
interface CharacterControllerPlaceholder {
  group: THREE.Group;
  capsule: THREE.Group;
  directionArrow: THREE.ArrowHelper;
  cameraOrbit: THREE.Line;
  config: CharacterControllerPlaceholderConfig;
}

/**
 * ThreeJS implementation of character controller placeholder renderer.
 * Renders a capsule wireframe with direction indicator.
 */
export class CharacterControllerPlaceholderRenderer implements PlaceholderRenderer {
  private adapter: { getOverlayScene: () => THREE.Scene };

  constructor(adapter: { getOverlayScene: () => THREE.Scene }) {
    this.adapter = adapter;
  }

  createPlaceholder(element: MElement<EditorGraphicsAdapter>): CharacterControllerPlaceholder {
    const config = {
      ...DEFAULT_CHARACTER_CONTROLLER_PLACEHOLDER_CONFIG,
      ...extractCharacterControllerConfig(element),
    };

    const group = new THREE.Group();
    group.name = "CharacterControllerPlaceholder";

    // Create capsule
    const capsule = this.createCapsule(config);
    group.add(capsule);

    // Create direction arrow
    const directionArrow = this.createDirectionArrow(config);
    group.add(directionArrow);

    // Create camera orbit indicator
    const cameraOrbit = this.createCameraOrbit(config);
    group.add(cameraOrbit);

    // Attach to element's container or parent
    const container = (element as unknown as MElement<ThreeJSGraphicsAdapter>).getContainer?.();
    if (container) {
      container.add(group);
    } else {
      // For character controller, attach to parent element's container
      const parent = element.parentElement;
      if (parent && MElement.isMElement(parent)) {
        const parentContainer = (parent as unknown as MElement<ThreeJSGraphicsAdapter>).getContainer();
        if (parentContainer) {
          parentContainer.add(group);
        }
      }
    }

    const placeholder: CharacterControllerPlaceholder = {
      group,
      capsule,
      directionArrow,
      cameraOrbit,
      config,
    };

    return placeholder;
  }

  updatePlaceholder(element: MElement<EditorGraphicsAdapter>, placeholder: unknown): void {
    const p = placeholder as CharacterControllerPlaceholder;

    const newConfig = {
      ...DEFAULT_CHARACTER_CONTROLLER_PLACEHOLDER_CONFIG,
      ...extractCharacterControllerConfig(element),
    };

    // Update camera orbit if distance changed
    if (
      newConfig.cameraDistance !== p.config.cameraDistance ||
      newConfig.cameraHeight !== p.config.cameraHeight
    ) {
      p.group.remove(p.cameraOrbit);
      p.cameraOrbit.geometry.dispose();
      (p.cameraOrbit.material as THREE.Material).dispose();

      const newOrbit = this.createCameraOrbit(newConfig);
      p.group.add(newOrbit);
      p.cameraOrbit = newOrbit;
      p.config = newConfig;
    }
  }

  disposePlaceholder(placeholder: unknown): void {
    const p = placeholder as CharacterControllerPlaceholder;

    // Dispose capsule
    p.capsule.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });

    // Dispose arrow
    p.directionArrow.dispose();

    // Dispose orbit
    p.cameraOrbit.geometry.dispose();
    (p.cameraOrbit.material as THREE.Material).dispose();

    p.group.removeFromParent();
  }

  private createCapsule(config: CharacterControllerPlaceholderConfig): THREE.Group {
    const group = new THREE.Group();
    group.name = "CapsuleWireframe";

    const geometry = calculateCapsuleGeometry(config);

    // Create wireframe capsule using line segments
    const segments = 24;
    const lineVertices: number[] = [];

    // Top hemisphere
    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;

      // Horizontal ring at top
      lineVertices.push(
        Math.cos(angle1) * config.radius,
        geometry.topCenter.y,
        Math.sin(angle1) * config.radius,
        Math.cos(angle2) * config.radius,
        geometry.topCenter.y,
        Math.sin(angle2) * config.radius,
      );

      // Vertical arcs for top hemisphere
      if (i % 6 === 0) {
        for (let j = 0; j < 8; j++) {
          const arcAngle1 = (j / 16) * Math.PI;
          const arcAngle2 = ((j + 1) / 16) * Math.PI;

          const y1 = geometry.topCenter.y + Math.sin(arcAngle1) * config.radius;
          const r1 = Math.cos(arcAngle1) * config.radius;
          const y2 = geometry.topCenter.y + Math.sin(arcAngle2) * config.radius;
          const r2 = Math.cos(arcAngle2) * config.radius;

          lineVertices.push(
            Math.cos(angle1) * r1, y1, Math.sin(angle1) * r1,
            Math.cos(angle1) * r2, y2, Math.sin(angle1) * r2,
          );
        }
      }
    }

    // Bottom hemisphere
    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;

      // Horizontal ring at bottom
      lineVertices.push(
        Math.cos(angle1) * config.radius,
        geometry.bottomCenter.y,
        Math.sin(angle1) * config.radius,
        Math.cos(angle2) * config.radius,
        geometry.bottomCenter.y,
        Math.sin(angle2) * config.radius,
      );

      // Vertical arcs for bottom hemisphere
      if (i % 6 === 0) {
        for (let j = 8; j < 16; j++) {
          const arcAngle1 = (j / 16) * Math.PI;
          const arcAngle2 = ((j + 1) / 16) * Math.PI;

          const y1 = geometry.bottomCenter.y + Math.sin(arcAngle1) * config.radius;
          const r1 = Math.cos(arcAngle1) * config.radius;
          const y2 = geometry.bottomCenter.y + Math.sin(arcAngle2) * config.radius;
          const r2 = Math.cos(arcAngle2) * config.radius;

          lineVertices.push(
            Math.cos(angle1) * r1, y1, Math.sin(angle1) * r1,
            Math.cos(angle1) * r2, y2, Math.sin(angle1) * r2,
          );
        }
      }
    }

    // Vertical lines connecting hemispheres
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      lineVertices.push(
        Math.cos(angle) * config.radius,
        geometry.topCenter.y,
        Math.sin(angle) * config.radius,
        Math.cos(angle) * config.radius,
        geometry.bottomCenter.y,
        Math.sin(angle) * config.radius,
      );
    }

    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute("position", new THREE.Float32BufferAttribute(lineVertices, 3));

    const lineMat = new THREE.LineBasicMaterial({
      color: config.wireframeColor,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: config.opacity,
    });

    const lines = new THREE.LineSegments(lineGeom, lineMat);
    lines.name = "CapsuleLines";
    group.add(lines);

    return group;
  }

  private createDirectionArrow(config: CharacterControllerPlaceholderConfig): THREE.ArrowHelper {
    const direction = new THREE.Vector3(0, 0, -1);
    const origin = new THREE.Vector3(0, config.height * 0.5, 0);
    const length = 0.5;
    const color = config.directionColor;

    const arrow = new THREE.ArrowHelper(direction, origin, length, color, 0.15, 0.1);
    arrow.name = "DirectionArrow";

    // Make arrow always visible
    arrow.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        const mat = child.material as THREE.Material;
        mat.depthTest = false;
        mat.depthWrite = false;
      }
    });

    return arrow;
  }

  private createCameraOrbit(config: CharacterControllerPlaceholderConfig): THREE.Line {
    // Create a circle showing the camera orbit distance
    const segments = 48;
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.sin(angle) * config.cameraDistance,
          config.cameraHeight,
          Math.cos(angle) * config.cameraDistance,
        ),
      );
    }

    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineDashedMaterial({
      color: 0x888888,
      dashSize: 0.2,
      gapSize: 0.1,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.5,
    });

    const line = new THREE.Line(geom, mat);
    line.name = "CameraOrbit";
    line.computeLineDistances();

    return line;
  }
}


