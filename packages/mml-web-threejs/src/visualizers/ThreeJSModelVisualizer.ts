import { MElement, ModelVisualizerGraphics, VisualizerOptions } from "@mml-io/mml-web";
import { ModelLoader } from "@mml-io/model-loader";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

const modelLoader = new ModelLoader();

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => mat.dispose());
      } else {
        mesh.material?.dispose();
      }
    }
  });
}

/**
 * ThreeJS implementation for model-based element visualizers (e.g. camera icon).
 */
export class ThreeJSModelVisualizer extends ModelVisualizerGraphics<ThreeJSGraphicsAdapter> {
  private group: THREE.Group;
  private currentModel: THREE.Object3D | null = null;
  private disposed = false;

  constructor(
    element: MElement<ThreeJSGraphicsAdapter>,
    url: string,
    scale: number,
    options?: VisualizerOptions,
  ) {
    super(element, url, scale, options);
    this.group = new THREE.Group();
    this.group.visible = true;
    this.group.name = "ModelVisualizer";
    this.group.userData.visualizerClickable = this.isClickable();
    this.element.getContainer().add(this.group);
    this.loadModel(url);
    console.log("ThreeJSModelVisualizer created", this.group, this.element.getContainer());
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  setScale(scale: number): void {
    this.scale = scale;
    this.group.scale.setScalar(scale);
  }

  setUrl(url: string): void {
    if (this.url === url) {
      return;
    }
    this.url = url;
    this.loadModel(url);
  }

  dispose(): void {
    this.disposed = true;
    if (this.currentModel) {
      disposeObject(this.currentModel);
    }
    this.group.removeFromParent();
  }

  private async loadModel(url: string): Promise<void> {
    const loadResult = await modelLoader.load(url).catch((error) => {
      console.error("Failed to load model visualizer", error);
      return null;
    });

    if (!loadResult || this.disposed) {
      return;
    }

    if (this.currentModel) {
      disposeObject(this.currentModel);
      this.group.remove(this.currentModel);
    }

    this.currentModel = loadResult.group;
    console.log("ThreeJSModelVisualizer loaded model", this.currentModel);
    this.group.add(this.currentModel);
    this.group.scale.setScalar(this.scale);
  }
}


