import {
  calculateFrustumCorners,
  CameraPlaceholderConfig,
  DEFAULT_CAMERA_PLACEHOLDER_CONFIG,
  extractCameraConfig,
  PlaceholderRenderer,
} from "@mml-io/mml-editor-core";
import { EditorGraphicsAdapter } from "@mml-io/mml-editor-core";
import { MElement } from "@mml-io/mml-web";
import { ThreeJSGraphicsAdapter } from "@mml-io/mml-web-threejs";
import * as THREE from "three";

/**
 * Camera frustum placeholder structure
 */
interface CameraPlaceholder {
  group: THREE.Group;
  frustumLines: THREE.LineSegments;
  frustumFaces: THREE.Mesh;
  cameraBody: THREE.Mesh;
  config: CameraPlaceholderConfig;
}

/**
 * ThreeJS implementation of camera placeholder renderer.
 * Renders a camera frustum wireframe and camera body icon.
 */
export class CameraPlaceholderRenderer implements PlaceholderRenderer {
  private adapter: { getOverlayScene: () => THREE.Scene };

  constructor(adapter: { getOverlayScene: () => THREE.Scene }) {
    this.adapter = adapter;
  }

  createPlaceholder(element: MElement<EditorGraphicsAdapter>): CameraPlaceholder {
    const config = {
      ...DEFAULT_CAMERA_PLACEHOLDER_CONFIG,
      ...extractCameraConfig(element),
    };

    const group = new THREE.Group();
    group.name = "CameraPlaceholder";

    // Create frustum
    const frustum = this.createFrustum(config);
    group.add(frustum.lines);
    group.add(frustum.faces);

    // Create camera body
    const cameraBody = this.createCameraBody(config);
    group.add(cameraBody);

    // Attach to element's container
    const container = (element as unknown as MElement<ThreeJSGraphicsAdapter>).getContainer();
    if (container) {
      container.add(group);
    }

    const placeholder: CameraPlaceholder = {
      group,
      frustumLines: frustum.lines,
      frustumFaces: frustum.faces,
      cameraBody,
      config,
    };

    return placeholder;
  }

  updatePlaceholder(element: MElement<EditorGraphicsAdapter>, placeholder: unknown): void {
    const p = placeholder as CameraPlaceholder;

    const newConfig = {
      ...DEFAULT_CAMERA_PLACEHOLDER_CONFIG,
      ...extractCameraConfig(element),
    };

    // Only rebuild if config changed
    if (newConfig.fov !== p.config.fov) {
      // Remove old frustum
      p.group.remove(p.frustumLines);
      p.group.remove(p.frustumFaces);
      p.frustumLines.geometry.dispose();
      p.frustumFaces.geometry.dispose();

      // Create new frustum
      const frustum = this.createFrustum(newConfig);
      p.group.add(frustum.lines);
      p.group.add(frustum.faces);
      p.frustumLines = frustum.lines;
      p.frustumFaces = frustum.faces;
      p.config = newConfig;
    }
  }

  disposePlaceholder(placeholder: unknown): void {
    const p = placeholder as CameraPlaceholder;

    p.frustumLines.geometry.dispose();
    (p.frustumLines.material as THREE.Material).dispose();
    p.frustumFaces.geometry.dispose();
    (p.frustumFaces.material as THREE.Material).dispose();
    p.cameraBody.geometry.dispose();
    (p.cameraBody.material as THREE.Material).dispose();

    p.group.removeFromParent();
  }

  private createFrustum(config: CameraPlaceholderConfig): {
    lines: THREE.LineSegments;
    faces: THREE.Mesh;
  } {
    const corners = calculateFrustumCorners(config);

    // Create line segments for frustum edges
    const lineVertices: number[] = [];

    // Near plane
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      lineVertices.push(
        corners.near[i].x, corners.near[i].y, corners.near[i].z,
        corners.near[j].x, corners.near[j].y, corners.near[j].z,
      );
    }

    // Far plane
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      lineVertices.push(
        corners.far[i].x, corners.far[i].y, corners.far[i].z,
        corners.far[j].x, corners.far[j].y, corners.far[j].z,
      );
    }

    // Connecting edges
    for (let i = 0; i < 4; i++) {
      lineVertices.push(
        corners.near[i].x, corners.near[i].y, corners.near[i].z,
        corners.far[i].x, corners.far[i].y, corners.far[i].z,
      );
    }

    // Origin to corners (camera rays)
    for (let i = 0; i < 4; i++) {
      lineVertices.push(0, 0, 0, corners.near[i].x, corners.near[i].y, corners.near[i].z);
    }

    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute("position", new THREE.Float32BufferAttribute(lineVertices, 3));

    const lineMat = new THREE.LineBasicMaterial({
      color: config.frustumColor,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.8,
    });

    const lines = new THREE.LineSegments(lineGeom, lineMat);
    lines.name = "CameraFrustumLines";

    // Create semi-transparent faces for frustum sides
    const faceVertices: number[] = [];

    // Near plane face
    faceVertices.push(
      corners.near[0].x, corners.near[0].y, corners.near[0].z,
      corners.near[1].x, corners.near[1].y, corners.near[1].z,
      corners.near[2].x, corners.near[2].y, corners.near[2].z,
      corners.near[0].x, corners.near[0].y, corners.near[0].z,
      corners.near[2].x, corners.near[2].y, corners.near[2].z,
      corners.near[3].x, corners.near[3].y, corners.near[3].z,
    );

    const faceGeom = new THREE.BufferGeometry();
    faceGeom.setAttribute("position", new THREE.Float32BufferAttribute(faceVertices, 3));
    faceGeom.computeVertexNormals();

    const faceMat = new THREE.MeshBasicMaterial({
      color: config.frustumColor,
      transparent: true,
      opacity: config.frustumOpacity,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });

    const faces = new THREE.Mesh(faceGeom, faceMat);
    faces.name = "CameraFrustumFaces";

    return { lines, faces };
  }

  private createCameraBody(config: CameraPlaceholderConfig): THREE.Mesh {
    // Simple camera icon - a box with a cone lens
    const group = new THREE.Group();

    // Camera body (box)
    const bodyGeom = new THREE.BoxGeometry(0.2, 0.15, 0.1);
    const bodyMat = new THREE.MeshBasicMaterial({
      color: config.bodyColor,
      depthTest: false,
      depthWrite: false,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.z = 0.05;

    // Lens (cylinder)
    const lensGeom = new THREE.CylinderGeometry(0.05, 0.08, 0.1, 16);
    const lensMat = new THREE.MeshBasicMaterial({
      color: 0x222222,
      depthTest: false,
      depthWrite: false,
    });
    const lens = new THREE.Mesh(lensGeom, lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = -0.05;

    // Combine into single geometry for efficiency
    const combined = new THREE.BufferGeometry();
    body.updateMatrix();
    lens.updateMatrix();

    // Just use the body for now (simpler)
    const mesh = new THREE.Mesh(bodyGeom.clone(), bodyMat.clone());
    mesh.name = "CameraBody";
    mesh.position.z = 0.1;

    return mesh;
  }
}


