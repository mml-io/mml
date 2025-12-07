import { TransformableElement } from "../elements";
import { GraphicsAdapter } from "../graphics";
import { HighlightConfig, HighlightHandle } from "../graphics/HighlightGraphics";
import {
  TransformMode,
  TransformSnapping,
  TransformSpace,
  TransformValues,
  TransformWidgetCallbacks,
  TransformWidgetGraphics,
} from "../graphics/TransformWidgetGraphics";

/**
 * Configuration for the TransformWidgetController.
 */
export interface TransformWidgetControllerConfig {
  /** Initial transform mode */
  initialMode?: TransformMode;
  /** Initial coordinate space */
  initialSpace?: TransformSpace;
  /** Initial snapping configuration */
  snapping?: TransformSnapping;
  /** Highlight configuration */
  highlightConfig?: HighlightConfig;
}

/**
 * Callbacks for TransformWidgetController events.
 */
export interface TransformWidgetControllerCallbacks {
  /** Called when selection changes */
  onSelectionChange?: (elements: TransformableElement<any>[] | null) => void;
  /** Called when a transform operation completes */
  onTransformCommit?: (element: TransformableElement<any>, values: TransformValues) => void;
  /** Called when drag state changes */
  onDragStateChange?: (isDragging: boolean) => void;
  /** Called when camera controls should be enabled/disabled */
  onControlsStateChange?: (enabled: boolean) => void;
}

/**
 * Controller that manages selection highlighting and transform widget operations.
 * Acts as the bridge between the editor and graphics implementations.
 */
export class TransformWidgetController<G extends GraphicsAdapter = GraphicsAdapter> {
  private selectedElements: TransformableElement<G>[] = [];
  private lastSelectedIndex: number = -1;
  private mode: TransformMode = "translate";
  private space: TransformSpace = "local";
  private snappingEnabled: boolean = false;
  private snappingConfig: TransformSnapping = {
    translation: 1,
    rotation: 45,
    scale: 0.25,
  };
  private enabled: boolean = true;
  private callbacks: TransformWidgetControllerCallbacks = {};

  private highlightHandle: HighlightHandle<G> | null = null;
  private widgetGraphics: TransformWidgetGraphics<G> | null = null;

  constructor(
    private config: TransformWidgetControllerConfig = {},
  ) {
    if (config.initialMode) {
      this.mode = config.initialMode;
    }
    if (config.initialSpace) {
      this.space = config.initialSpace;
    }
    if (config.snapping) {
      this.snappingConfig = { ...this.snappingConfig, ...config.snapping };
    }
  }

  /**
   * Set the graphics implementations.
   * Should be called once the graphics adapter is available.
   */
  public setGraphics(
    highlightHandle: HighlightHandle<G>,
    widgetGraphics: TransformWidgetGraphics<G>,
  ): void {
    this.highlightHandle = highlightHandle;
    this.widgetGraphics = widgetGraphics;

    // Apply initial configuration
    if (this.config.highlightConfig) {
      this.highlightHandle.setConfig(this.config.highlightConfig);
    }

    this.widgetGraphics.setMode(this.mode);
    this.widgetGraphics.setSpace(this.space);
    this.widgetGraphics.setSnapping(this.snappingConfig);
    this.widgetGraphics.setSnappingEnabled(this.snappingEnabled);

    // Set up widget callbacks
    this.widgetGraphics.setCallbacks({
      onDragStart: () => {
        console.log("[TransformWidgetController] onDragStart");
        this.callbacks.onDragStateChange?.(true);
      },
      onDragEnd: (element, values) => {
        console.log("[TransformWidgetController] onDragEnd");
        console.log("[TransformWidgetController] Element:", element);
        console.log("[TransformWidgetController] Values:", values);
        this.callbacks.onDragStateChange?.(false);
        this.callbacks.onTransformCommit?.(element, values);
      },
      onControlsStateChange: (enabled) => {
        console.log("[TransformWidgetController] onControlsStateChange:", enabled);
        this.callbacks.onControlsStateChange?.(enabled);
      },
    });

    // Sync current selection state
    this.syncGraphics();
  }

  /**
   * Set event callbacks.
   */
  public setCallbacks(callbacks: TransformWidgetControllerCallbacks): void {
    console.log("[TransformWidgetController] setCallbacks called");
    this.callbacks = callbacks;

    // Update widget callbacks if graphics are available
    if (this.widgetGraphics) {
      this.widgetGraphics.setCallbacks({
        onDragStart: () => {
          console.log("[TransformWidgetController] onDragStart (from setCallbacks)");
          this.callbacks.onDragStateChange?.(true);
        },
        onDragEnd: (element, values) => {
          console.log("[TransformWidgetController] onDragEnd (from setCallbacks)");
          console.log("[TransformWidgetController] Element:", element);
          console.log("[TransformWidgetController] Values:", values);
          this.callbacks.onDragStateChange?.(false);
          this.callbacks.onTransformCommit?.(element, values);
        },
        onControlsStateChange: (enabled) => {
          console.log("[TransformWidgetController] onControlsStateChange (from setCallbacks):", enabled);
          this.callbacks.onControlsStateChange?.(enabled);
        },
      });
    }
  }

  /**
   * Set selected elements.
   * @param elements Elements to select
   * @param lastSelectedIndex Index of the last selected element (for gizmo pivot)
   */
  public setSelectedElements(
    elements: TransformableElement<G>[],
    lastSelectedIndex?: number,
  ): void {
    // Clear isSelected on previously selected elements
    for (const el of this.selectedElements) {
      el.isSelected = false;
    }
    
    this.selectedElements = elements;
    this.lastSelectedIndex = lastSelectedIndex ?? elements.length - 1;
    
    // Set isSelected on newly selected elements
    for (const el of this.selectedElements) {
      el.isSelected = true;
    }
    
    this.syncGraphics();
    this.callbacks.onSelectionChange?.(elements.length > 0 ? elements : null);
  }

  /**
   * Clear selection.
   */
  public clearSelection(): void {
    // Clear isSelected on all previously selected elements
    for (const el of this.selectedElements) {
      el.isSelected = false;
    }
    
    this.selectedElements = [];
    this.lastSelectedIndex = -1;
    this.syncGraphics();
    this.callbacks.onSelectionChange?.(null);
  }

  /**
   * Get currently selected elements.
   */
  public getSelectedElements(): TransformableElement<G>[] {
    return [...this.selectedElements];
  }

  /**
   * Set transform mode.
   */
  public setMode(mode: TransformMode): void {
    this.mode = mode;
    this.widgetGraphics?.setMode(mode);
  }

  /**
   * Get current transform mode.
   */
  public getMode(): TransformMode {
    return this.mode;
  }

  /**
   * Set coordinate space.
   */
  public setSpace(space: TransformSpace): void {
    this.space = space;
    this.widgetGraphics?.setSpace(space);
  }

  /**
   * Get current coordinate space.
   */
  public getSpace(): TransformSpace {
    return this.space;
  }

  /**
   * Toggle coordinate space between local and world.
   */
  public toggleSpace(): void {
    this.space = this.space === "local" ? "world" : "local";
    this.widgetGraphics?.setSpace(this.space);
  }

  /**
   * Enable or disable snapping.
   */
  public setSnappingEnabled(enabled: boolean): void {
    this.snappingEnabled = enabled;
    this.widgetGraphics?.setSnappingEnabled(enabled);
  }

  /**
   * Check if snapping is enabled.
   */
  public isSnappingEnabled(): boolean {
    return this.snappingEnabled;
  }

  /**
   * Set snapping configuration values.
   */
  public setSnappingConfig(config: TransformSnapping): void {
    this.snappingConfig = { ...this.snappingConfig, ...config };
    this.widgetGraphics?.setSnapping(this.snappingConfig);
  }

  /**
   * Set highlight configuration.
   */
  public setHighlightConfig(config: HighlightConfig): void {
    this.highlightHandle?.setConfig(config);
  }

  /**
   * Enable the controller.
   */
  public enable(): void {
    this.enabled = true;
    this.widgetGraphics?.enable();
    this.syncGraphics();
  }

  /**
   * Disable the controller (clears selection and hides widget).
   */
  public disable(): void {
    this.enabled = false;
    this.clearSelection();
    this.widgetGraphics?.disable();
  }

  /**
   * Check if controller is enabled.
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check if widget is currently being dragged.
   */
  public isDragging(): boolean {
    return this.widgetGraphics?.isDragging() ?? false;
  }

  /**
   * Sync graphics state with current selection.
   */
  private syncGraphics(): void {
    if (!this.enabled) {
      this.highlightHandle?.clear();
      this.widgetGraphics?.detach();
      return;
    }

    if (this.selectedElements.length > 0) {
      this.highlightHandle?.setElements(this.selectedElements);
      this.widgetGraphics?.attach(this.selectedElements, this.lastSelectedIndex);
    } else {
      this.highlightHandle?.clear();
      this.widgetGraphics?.detach();
    }
  }

  /**
   * Update (called per frame if needed).
   */
  public update(): void {
    // HighlightManager handles updates internally
  }

  /**
   * Dispose of the controller and its resources.
   */
  public dispose(): void {
    this.clearSelection();
    this.highlightHandle?.dispose();
    this.widgetGraphics?.dispose();
    this.highlightHandle = null;
    this.widgetGraphics = null;
  }
}

