import { MElement } from "../elements";
import { VisualizerDescriptor } from "../visuals";
import { GraphicsAdapter } from "./GraphicsAdapter";

/**
 * Interface for a rendered element visualizer that can be shown/hidden and disposed.
 */
export interface ElementVisualizer<G extends GraphicsAdapter = GraphicsAdapter> {
  /**
   * Get the container object for the visualizer.
   */
  getObject(): G["containerType"];

  /**
   * Update the visualizer with a new descriptor (e.g., when light color changes).
   */
  update(descriptor: VisualizerDescriptor): void;

  /**
   * Show or hide the visualizer.
   */
  setVisible(visible: boolean): void;

  /**
   * Clean up resources.
   */
  dispose(): void;
}

/**
 * Factory interface for creating element visualizers from descriptors.
 * Implemented by graphics adapters (e.g., ThreeJS).
 */
export abstract class ElementVisualizerFactory<G extends GraphicsAdapter = GraphicsAdapter> {
  /**
   * Create an element visualizer from a descriptor.
   * @param element The MElement that owns this visualizer
   * @param descriptor The visualizer descriptor defining what to render
   * @returns An element visualizer, or null if the descriptor type is not supported
   */
  abstract createVisualizer(
    element: MElement<G>,
    descriptor: VisualizerDescriptor,
  ): ElementVisualizer<G> | null;
}
