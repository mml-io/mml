import type { MElement } from "../elements";
import { GraphicsAdapter } from "../graphics";
import { EditorGraphicsSupport, hasEditorSupport, VisualizerHandler } from "../graphics/EditorGraphicsSupport";
import type { ElementVisualizer, ElementVisualizerFactory } from "../graphics/VisualGraphics";
import type { VisualizerDescriptor } from "./VisualDescriptor";

/**
 * Generic controller that bridges adapter-agnostic visualizer descriptors
 * returned by elements to adapter-specific visualizer instances.
 */
export class ElementVisualizerController<G extends GraphicsAdapter = GraphicsAdapter>
  implements VisualizerHandler {
  private visualizer: ElementVisualizer<G> | null = null;
  private visualizerVisible = false;
  private currentDescriptorType: VisualizerDescriptor["type"] | null = null;
  private editorSupport: EditorGraphicsSupport<G> | null = null;

  constructor(
    private element: MElement<G>,
    private factory: ElementVisualizerFactory<G>,
    adapter: G,
  ) {
    this.editorSupport = hasEditorSupport(adapter) ? adapter : null;
    this.visualizerVisible = this.editorSupport?.getVisualizersVisible?.() ?? false;

    if (this.editorSupport) {
      this.editorSupport.registerVisualizerHandler(this);
    }

    this.refreshVisualizer();
  }

  /**
   * Refresh or recreate the visualizer based on the element's current state.
   */
  public refreshVisualizer(): void {
    const descriptor = this.element.getElementVisualizer(this.element.isSelected);

    if (!descriptor) {
      this.disposeVisualizer();
      return;
    }

    if (this.visualizer && descriptor.type === this.currentDescriptorType) {
      this.visualizer.update(descriptor);
      this.applyVisibility();
      return;
    }

    this.disposeVisualizer();

    this.visualizer = this.factory.createVisualizer(this.element, descriptor);
    if (!this.visualizer) {
      this.currentDescriptorType = null;
      return;
    }

    this.currentDescriptorType = descriptor.type;
    const container = this.element.getContainer() as unknown as { add?: (child: unknown) => void };
    container.add?.(this.visualizer.getObject());
    this.applyVisibility();
  }

  /**
   * Update visibility when the adapter toggles visualizers.
   */
  public setVisualizerVisible(visible: boolean): void {
    this.visualizerVisible = visible;
    this.applyVisibility();
  }

  /**
   * React to selection changes from the element.
   */
  public handleSelectionChanged(): void {
    this.refreshVisualizer();
  }

  /**
   * Clean up resources and unregister from the adapter.
   */
  public dispose(): void {
    if (this.editorSupport) {
      this.editorSupport.unregisterVisualizerHandler(this);
    }
    this.disposeVisualizer();
  }

  private applyVisibility(): void {
    if (this.visualizer) {
      this.visualizer.setVisible(this.visualizerVisible);
    }
  }

  private disposeVisualizer(): void {
    if (this.visualizer) {
      (this.visualizer.getObject() as any)?.removeFromParent?.();
      this.visualizer.dispose();
      this.visualizer = null;
      this.currentDescriptorType = null;
    }
  }
}

