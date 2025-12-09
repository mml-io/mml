import { TransformableElement } from "../elements";
import { EditorGraphicsSupport, hasEditorSupport, VisualizerHandler } from "./EditorGraphicsSupport";
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
  implements ElementVisualizer<G>, VisualizerHandler
{
  private container: CameraVisualizerContainer = { visible: true };
  private selected = false;
  private enabled = true;
  private cameraModelGraphics: ModelVisualizerGraphics<G>;
  private editorSupport: EditorGraphicsSupport<G> | null = null;

  constructor(private camera: TransformableElement<G>) {
    const graphicsAdapter = this.camera.getScene().getGraphicsAdapter();
    const factory = graphicsAdapter.getGraphicsAdapterFactory();

    this.cameraModelGraphics = factory.ModelVisualizerGraphicsInterface(
      this.camera,
      CAMERA_MODEL_URL,
      CAMERA_MODEL_SCALE,
    );

    this.updateVisibility();

    if (hasEditorSupport(graphicsAdapter)) {
      this.editorSupport = graphicsAdapter;
      this.editorSupport.registerVisualizerHandler(this);
    }
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

  setVisualizerVisible(visible: boolean): void {
    this.setVisible(visible);
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
    this.editorSupport?.unregisterVisualizerHandler(this);
    this.editorSupport = null;
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


