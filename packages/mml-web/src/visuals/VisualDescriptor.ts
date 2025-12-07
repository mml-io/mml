import { MMLColor } from "../color";

/**
 * Visualizer descriptors are adapter-agnostic definitions of visualizers that can be rendered
 * by different graphics adapters (e.g., ThreeJS, Babylon.js).
 *
 * Elements define their visualizers using these descriptors, and the graphics adapter
 * is responsible for instantiating the actual renderable objects.
 */

/**
 * A billboard visualizer that always faces the camera.
 * Used for icons representing invisible elements like lights.
 */
export type BillboardVisualizerDescriptor = {
  type: "billboard";
  /**
   * SVG content as a string to render as a billboard.
   */
  svgContent: string;
  /**
   * Size of the billboard in world units.
   */
  size: number;
  /**
   * Optional tint color for the billboard.
   */
  color?: MMLColor;
};

/**
 * A GLB/GLTF model visualizer.
 * Used for visualizers like camera icons that are 3D models.
 */
export type ModelVisualizerDescriptor = {
  type: "model";
  /**
   * URL to the GLB/GLTF model.
   */
  url: string;
  /**
   * Scale factor for the model.
   */
  scale?: number;
};

/**
 * Helper visualizer for a point light showing its range.
 */
export type PointLightHelperDescriptor = {
  type: "pointLightHelper";
  /**
   * Distance/range of the point light (null = infinite).
   */
  distance: number | null;
  /**
   * Color of the helper visualization.
   */
  color: MMLColor;
};

/**
 * Helper visualizer for a spotlight showing its cone.
 */
export type SpotLightHelperDescriptor = {
  type: "spotLightHelper";
  /**
   * Angle of the spotlight cone in degrees.
   */
  angleDeg: number;
  /**
   * Distance/range of the spotlight (null = infinite).
   */
  distance: number | null;
  /**
   * Color of the helper visualization.
   */
  color: MMLColor;
};

/**
 * Union of all visualizer descriptor types.
 */
export type VisualizerDescriptor =
  | BillboardVisualizerDescriptor
  | ModelVisualizerDescriptor
  | PointLightHelperDescriptor
  | SpotLightHelperDescriptor;
