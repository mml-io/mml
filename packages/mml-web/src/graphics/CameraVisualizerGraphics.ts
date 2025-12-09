import { TransformableElement } from "../elements";
import { GraphicsAdapter } from "./GraphicsAdapter";
import { ModelVisualizerGraphics } from "./ModelVisualizerGraphics";
import { ElementVisualizer } from "./Visualizer";

const CAMERA_MODEL_URL = "https://storage.googleapis.com/ai-game-creator/camera.glb";
const CAMERA_MODEL_SCALE = 1;

type CameraVisualizerContainer = {
  visible: boolean;
};

/**
 * Visualizer controller for cameras that drives a model visualizer instance.
 */
export class CameraVisualizerGraphics<G extends GraphicsAdapter = GraphicsAdapter>
  implements ElementVisualizer<G>
{
  private container: CameraVisualizerContainer = { visible: true };
  private selected = false;
  private enabled = true;
  private cameraModelGraphics: ModelVisualizerGraphics<G>;

  constructor(private camera: TransformableElement<G>) {
    const graphicsAdapter = this.camera.getScene().getGraphicsAdapter();
    const factory = graphicsAdapter.getGraphicsAdapterFactory();

    this.cameraModelGraphics = factory.ModelVisualizerGraphicsInterface(
      this.camera,
      CAMERA_MODEL_URL,
      CAMERA_MODEL_SCALE,
    );

    this.updateVisibility();
  }

  getContainer(): G["containerType"] {
    return this.container as unknown as G["containerType"];
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.updateVisibility();
  }

  setVisible(visible: boolean): void {
    this.container.visible = visible;
    this.updateVisibility();
  }

  enable(): void {
    this.setEnabled(true);
  }

  disable(): void {
    this.setEnabled(false);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.updateVisibility();
  }

  setScale(scale: number): void {
    this.cameraModelGraphics.setScale(scale);
  }

  setModelUrl(url: string): void {
    this.cameraModelGraphics.setUrl(url);
  }

  dispose(): void {
    this.cameraModelGraphics.dispose();
    this.container = null as unknown as CameraVisualizerContainer;
  }

  private updateVisibility(): void {
    const shouldShow = this.container.visible && this.enabled;

    // Camera visualizer is always shown when visualizers are enabled; selection state
    // does not change visibility but is tracked for parity with other visualizers.
    this.cameraModelGraphics.setVisible(shouldShow);
  }
}


