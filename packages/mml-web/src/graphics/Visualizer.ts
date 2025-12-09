import { GraphicsAdapter } from "./GraphicsAdapter";

/**
 * Interface for a rendered element visualizer that can be shown/hidden and disposed.
 */
export interface ElementVisualizer<G extends GraphicsAdapter = GraphicsAdapter> {
  /**
   * Get the container object for the visualizer.
   */
  getContainer(): G["containerType"];

  /**
   * Set the selected state of the visualizer.
   */
  setSelected(selected: boolean): void;

  /**
   * Show or hide the visualizer.
   */
  setVisible(visible: boolean): void;

  /**
   * Clean up resources.
   */
  dispose(): void;
}