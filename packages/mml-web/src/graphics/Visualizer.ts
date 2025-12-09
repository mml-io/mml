import { GraphicsAdapter } from "./GraphicsAdapter";

export type VisualizerOptions = {
  /**
   * Whether the visualizer should be hit-testable/clickable.
   * Defaults to true.
   */
  clickable?: boolean;
};

export class VisualizerManager {
  private static singleton: VisualizerManager | null = null;
  private visualizers: ElementVisualizer<GraphicsAdapter>[] = [];

  constructor() {
  }

  public static get(): VisualizerManager {
    if (!VisualizerManager.singleton) {
      VisualizerManager.singleton = new VisualizerManager();
    }
    return VisualizerManager.singleton;
  }

  public addVisualizer(visualizer: ElementVisualizer<GraphicsAdapter>) {
    this.visualizers.push(visualizer);
  }

  public removeVisualizer(visualizer: ElementVisualizer<GraphicsAdapter>) {
    this.visualizers = this.visualizers.filter((v) => v !== visualizer);
  }

  public setVisible(visible: boolean) {
    this.visualizers.forEach((v) => v.setVisible(visible));
  }
}

/**
 * Interface for a rendered element visualizer that can be shown/hidden and disposed.
 */
export abstract class ElementVisualizer<G extends GraphicsAdapter = GraphicsAdapter> {
  constructor() {
    VisualizerManager.get().addVisualizer(this);
  }

  /**
   * Get the container object for the visualizer.
   */
  abstract getContainer(): G["containerType"];

  /**
   * Set the selected state of the visualizer.
   */
  abstract setSelected(selected: boolean): void;

  /**
   * Show or hide the visualizer.
   */
  abstract setVisible(visible: boolean): void;

  /**
   * Clean up resources.
   */
  dispose(): void {
    VisualizerManager.get().removeVisualizer(this);
  }
}