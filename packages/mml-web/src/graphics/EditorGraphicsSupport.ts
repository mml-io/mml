import { GraphicsAdapter } from "./GraphicsAdapter";
import { HighlightManager } from "./HighlightGraphics";
import { TransformWidgetGraphics } from "./TransformWidgetGraphics";

/**
 * Callback type for scene clicks. Receives the clicked element (or null if nothing was hit).
 * Return true to prevent the default click event dispatch.
 */
export type SceneClickCallback = (element: HTMLElement | null, event: MouseEvent) => boolean | void;

/**
 * Interface for graphics adapters that support editor functionality.
 * This provides a way to create selection highlights, transform widgets, and handle clicks
 * without depending on specific graphics implementations.
 */
export interface EditorGraphicsSupport<G extends GraphicsAdapter = GraphicsAdapter> {
  /**
   * Get the highlight manager for creating and managing multiple highlights.
   */
  getHighlightManager(): HighlightManager<G>;

  /**
   * Create a transform widget graphics instance.
   * @param domElement The DOM element for mouse event handling
   */
  createTransformWidget(domElement: HTMLElement): TransformWidgetGraphics<G>;

  /**
   * Set a callback to be invoked on every scene click for selection handling.
   * @param callback The callback function, or null to clear
   */
  setSceneClickCallback(callback: SceneClickCallback | null): void;
}

/**
 * Type guard to check if a graphics adapter supports editor functionality.
 */
export function hasEditorSupport<G extends GraphicsAdapter>(
  adapter: G,
): adapter is G & EditorGraphicsSupport<G> {
  return (
    "getHighlightManager" in adapter &&
    "createTransformWidget" in adapter &&
    "setSceneClickCallback" in adapter
  );
}

