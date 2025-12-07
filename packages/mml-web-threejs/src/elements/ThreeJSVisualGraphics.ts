import {
  MElement,
  MMLColor,
  VisualizerDescriptor,
  ElementVisualizerFactory,
  ElementVisualizer,
} from "@mml-io/mml-web";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

/**
 * Helper size for point light visualization.
 */
const POINT_LIGHT_HELPER_SIZE = 0.25;

/**
 * Creates a billboard sprite from SVG content.
 */
function createSvgBillboard(
  svgContent: string,
  size: number,
  color?: MMLColor,
): THREE.Sprite {
  // Create a canvas to render the SVG
  const canvas = document.createElement("canvas");
  const resolution = 128;
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext("2d")!;

  // Apply color tint if specified by modifying SVG
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

  // Create an image from SVG
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

  // Load SVG into canvas asynchronously
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
 * Creates a THREE color from an MMLColor.
 */
function mmlColorToThree(color: MMLColor): THREE.Color {
  return new THREE.Color(color.r, color.g, color.b);
}

/**
 * Billboard element visualizer using THREE.Sprite.
 */
class ThreeJSBillboardVisualizer implements ElementVisualizer<ThreeJSGraphicsAdapter> {
  private sprite: THREE.Sprite;

  constructor(svgContent: string, size: number, color?: MMLColor) {
    this.sprite = createSvgBillboard(svgContent, size, color);
  }

  getObject(): THREE.Object3D {
    return this.sprite;
  }

  update(descriptor: VisualizerDescriptor): void {
    if (descriptor.type === "billboard") {
      // Recreate sprite with new parameters
      const parent = this.sprite.parent;
      const oldSprite = this.sprite;
      this.sprite = createSvgBillboard(descriptor.svgContent, descriptor.size, descriptor.color);
      this.sprite.visible = oldSprite.visible;
      if (parent) {
        parent.remove(oldSprite);
        parent.add(this.sprite);
      }
      oldSprite.material.dispose();
      if (oldSprite.material.map) {
        oldSprite.material.map.dispose();
      }
    }
  }

  setVisible(visible: boolean): void {
    this.sprite.visible = visible;
  }

  dispose(): void {
    this.sprite.removeFromParent();
    this.sprite.material.dispose();
    if (this.sprite.material.map) {
      this.sprite.material.map.dispose();
    }
  }
}

/**
 * Model element visualizer using GLTF loader.
 */
class ThreeJSModelVisualizer implements ElementVisualizer<ThreeJSGraphicsAdapter> {
  private container: THREE.Object3D;
  private model: THREE.Object3D | null = null;
  private url: string;
  private scale: number;

  constructor(url: string, scale: number = 1) {
    this.container = new THREE.Object3D();
    this.url = url;
    this.scale = scale;
    this.loadModel();
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
    loader.load(
      this.url,
      (gltf) => {
        if (this.model) {
          this.container.remove(this.model);
        }
        this.model = gltf.scene;
        this.model.scale.setScalar(this.scale);
        this.container.add(this.model);
      },
      undefined,
      (error) => {
        console.error("Error loading visualizer model:", error);
      },
    );
  }

  getObject(): THREE.Object3D {
    return this.container;
  }

  update(descriptor: VisualizerDescriptor): void {
    if (descriptor.type === "model") {
      if (descriptor.url !== this.url) {
        this.url = descriptor.url;
        this.scale = descriptor.scale ?? 1;
        this.loadModel();
      } else if (descriptor.scale !== undefined && descriptor.scale !== this.scale) {
        this.scale = descriptor.scale;
        if (this.model) {
          this.model.scale.setScalar(this.scale);
        }
      }
    }
  }

  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  dispose(): void {
    this.container.removeFromParent();
    if (this.model) {
      this.model.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
    }
  }
}

/**
 * Point light helper element visualizer.
 */
class ThreeJSPointLightHelperVisualizer implements ElementVisualizer<ThreeJSGraphicsAdapter> {
  private helper: THREE.Object3D;

  constructor(distance: number | null, color: MMLColor) {
    // Create a simple sphere wireframe to represent the point light range
    const radius = distance ?? 10;
    const geometry = new THREE.SphereGeometry(radius, 16, 12);
    const material = new THREE.MeshBasicMaterial({
      color: mmlColorToThree(color),
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    this.helper = new THREE.Mesh(geometry, material);

    // Also add a small center marker
    const centerGeometry = new THREE.SphereGeometry(POINT_LIGHT_HELPER_SIZE, 8, 6);
    const centerMaterial = new THREE.MeshBasicMaterial({
      color: mmlColorToThree(color),
    });
    const center = new THREE.Mesh(centerGeometry, centerMaterial);
    this.helper.add(center);
  }

  getObject(): THREE.Object3D {
    return this.helper;
  }

  update(descriptor: VisualizerDescriptor): void {
    if (descriptor.type === "pointLightHelper") {
      const mesh = this.helper as THREE.Mesh;
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.color = mmlColorToThree(descriptor.color);

      // Update radius
      const newRadius = descriptor.distance ?? 10;
      mesh.geometry.dispose();
      mesh.geometry = new THREE.SphereGeometry(newRadius, 16, 12);
    }
  }

  setVisible(visible: boolean): void {
    this.helper.visible = visible;
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

/**
 * Spotlight helper element visualizer showing the cone.
 */
class ThreeJSSpotLightHelperVisualizer implements ElementVisualizer<ThreeJSGraphicsAdapter> {
  private helper: THREE.Object3D;

  constructor(angleDeg: number, distance: number | null, color: MMLColor) {
    this.helper = new THREE.Object3D();
    this.createCone(angleDeg, distance, color);
  }

  private createCone(angleDeg: number, distance: number | null, color: MMLColor): void {
    // Clear existing children
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

    // Create cone geometry
    const geometry = new THREE.ConeGeometry(radius, length, 16, 1, true);
    const material = new THREE.MeshBasicMaterial({
      color: mmlColorToThree(color),
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const cone = new THREE.Mesh(geometry, material);
    // Position cone so apex is at origin, pointing down -Y
    cone.rotation.x = Math.PI;
    cone.position.y = -length / 2;
    this.helper.add(cone);

    // Add center line
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

  getObject(): THREE.Object3D {
    return this.helper;
  }

  update(descriptor: VisualizerDescriptor): void {
    if (descriptor.type === "spotLightHelper") {
      this.createCone(descriptor.angleDeg, descriptor.distance, descriptor.color);
    }
  }

  setVisible(visible: boolean): void {
    this.helper.visible = visible;
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
}

/**
 * ThreeJS implementation of ElementVisualizerFactory.
 * Creates element visualizers from descriptors for rendering editor visualizers.
 */
export class ThreeJSElementVisualizerFactory extends ElementVisualizerFactory<ThreeJSGraphicsAdapter> {
  createVisualizer(
    _element: MElement<ThreeJSGraphicsAdapter>,
    descriptor: VisualizerDescriptor,
  ): ElementVisualizer<ThreeJSGraphicsAdapter> | null {
    switch (descriptor.type) {
      case "billboard":
        return new ThreeJSBillboardVisualizer(descriptor.svgContent, descriptor.size, descriptor.color);

      case "model":
        return new ThreeJSModelVisualizer(descriptor.url, descriptor.scale);

      case "pointLightHelper":
        return new ThreeJSPointLightHelperVisualizer(descriptor.distance, descriptor.color);

      case "spotLightHelper":
        return new ThreeJSSpotLightHelperVisualizer(
          descriptor.angleDeg,
          descriptor.distance,
          descriptor.color,
        );

      default:
        console.warn("Unknown visualizer descriptor type:", (descriptor as VisualizerDescriptor).type);
        return null;
    }
  }
}
