import { TransformableElement } from "../elements";
import { GraphicsAdapter } from "./GraphicsAdapter";

/**
 * Transform widget mode (translate, rotate, or scale).
 */
export type TransformMode = "translate" | "rotate" | "scale";

/**
 * Transform widget coordinate space.
 */
export type TransformSpace = "local" | "world";

/**
 * Transform delta values emitted during drag operations.
 */
export interface TransformDelta {
  /** Position delta */
  position?: { x: number; y: number; z: number };
  /** Rotation delta in degrees */
  rotation?: { x: number; y: number; z: number };
  /** Scale delta (multiplicative) */
  scale?: { x: number; y: number; z: number };
}

/**
 * Final transform values after drag completes.
 */
export interface TransformValues {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

/**
 * Snapping configuration for transform operations.
 */
export interface TransformSnapping {
  /** Translation snap value (units) */
  translation?: number | null;
  /** Rotation snap value (degrees) */
  rotation?: number | null;
  /** Scale snap value */
  scale?: number | null;
}

/**
 * Callbacks for transform widget events.
 */
export interface TransformWidgetCallbacks {
  /** Called when drag starts */
  onDragStart?: () => void;
  /** Called during drag with delta values */
  onDragChange?: (delta: TransformDelta) => void;
  /** Called when drag ends with final values for each element */
  onDragEnd?: (element: TransformableElement<any>, values: TransformValues) => void;
  /** Called when controls state changes (enabled/disabled) */
  onControlsStateChange?: (enabled: boolean) => void;
}

/**
 * Abstract base class for transform widget graphics.
 * Implementations should provide a 3D gizmo for translating, rotating, and scaling elements.
 */
export abstract class TransformWidgetGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  /**
   * Attach the widget to elements.
   * If multiple elements, widget attaches to the last one but transforms all.
   * @param elements Elements to transform
   * @param lastSelectedIndex Index of the last selected element (for pivot position)
   */
  abstract attach(elements: TransformableElement<G>[], lastSelectedIndex?: number): void;

  /**
   * Detach the widget from all elements.
   */
  abstract detach(): void;

  /**
   * Set the transform mode.
   * @param mode The transform mode (translate, rotate, scale)
   */
  abstract setMode(mode: TransformMode): void;

  /**
   * Get the current transform mode.
   */
  abstract getMode(): TransformMode;

  /**
   * Set the coordinate space.
   * @param space The coordinate space (local or world)
   */
  abstract setSpace(space: TransformSpace): void;

  /**
   * Get the current coordinate space.
   */
  abstract getSpace(): TransformSpace;

  /**
   * Toggle between local and world space.
   */
  abstract toggleSpace(): void;

  /**
   * Set snapping configuration.
   * @param snapping Snapping values (null to disable)
   */
  abstract setSnapping(snapping: TransformSnapping): void;

  /**
   * Enable or disable snapping.
   * @param enabled Whether snapping is enabled
   */
  abstract setSnappingEnabled(enabled: boolean): void;

  /**
   * Set the widget size.
   * @param size Widget size multiplier
   */
  abstract setSize(size: number): void;

  /**
   * Show/hide specific axes.
   * @param showX Show X axis
   * @param showY Show Y axis
   * @param showZ Show Z axis
   */
  abstract setAxisVisibility(showX: boolean, showY: boolean, showZ: boolean): void;

  /**
   * Register event callbacks.
   * @param callbacks Event callback handlers
   */
  abstract setCallbacks(callbacks: TransformWidgetCallbacks): void;

  /**
   * Check if the widget is currently being dragged.
   */
  abstract isDragging(): boolean;

  /**
   * Enable the widget.
   */
  abstract enable(): void;

  /**
   * Disable the widget.
   */
  abstract disable(): void;

  /**
   * Dispose of widget resources.
   */
  abstract dispose(): void;
}

