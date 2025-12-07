import { ModelVisualizerDescriptor, VisualizerDescriptor } from "./VisualDescriptor";

/**
 * URL to the camera GLB model used for camera visualizer representation in editor mode.
 */
const CAMERA_MODEL_URL = "https://storage.googleapis.com/ai-game-creator/camera.glb";

/**
 * Default scale for the camera model visualizer.
 */
const CAMERA_MODEL_SCALE = 1;

/**
 * Creates a model visualizer descriptor for a camera icon.
 */
export function createCameraModelDescriptor(scale: number = CAMERA_MODEL_SCALE): ModelVisualizerDescriptor {
  return {
    type: "model",
    url: CAMERA_MODEL_URL,
    scale,
  };
}

/**
 * Gets the default visualizer for a camera element.
 * Returns a 3D camera model.
 */
export function getCameraVisualizer(): VisualizerDescriptor {
  return createCameraModelDescriptor();
}

/**
 * Gets the selected visualizer for a camera element.
 * Returns null as cameras don't have an alternate selected state.
 */
export function getCameraSelectedVisualizer(): VisualizerDescriptor | null {
  return null;
}
