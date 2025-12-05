import { TransformableElement } from "../elements";
import { GraphicsAdapter } from "./GraphicsAdapter";

/**
 * Configuration for highlight appearance.
 */
export interface HighlightConfig {
  /** Highlight color (hex or CSS color string) */
  color?: number | string;
  /** Edge strength for outline effect */
  strength?: number;
  /** Edge thickness for outline effect */
  thickness?: number;
  /** Glow amount for outline effect */
  glow?: number;
}

/**
 * Default highlight configuration values.
 */
export const DefaultHighlightConfig: Required<HighlightConfig> = {
  color: 0xffcc00,
  strength: 4.0,
  thickness: 1.5,
  glow: 0.0,
};

/**
 * A handle to a single highlight instance.
 * Each instance tracks its own set of elements and configuration.
 * Multiple highlights can coexist with different colors (e.g., team colors, selections).
 */
export interface HighlightHandle<G extends GraphicsAdapter = GraphicsAdapter> {
  /** Unique identifier for this highlight */
  readonly id: string;

  /**
   * Set the elements to highlight.
   * @param elements Array of transformable elements to highlight
   */
  setElements(elements: TransformableElement<G>[]): void;

  /**
   * Get the currently highlighted elements.
   */
  getElements(): TransformableElement<G>[];

  /**
   * Update highlight configuration (color, strength, etc.).
   * @param config Highlight configuration options
   */
  setConfig(config: HighlightConfig): void;

  /**
   * Get the current highlight configuration.
   */
  getConfig(): Required<HighlightConfig>;

  /**
   * Clear all elements from this highlight.
   */
  clear(): void;

  /**
   * Dispose of this highlight handle.
   * Removes all highlights and unregisters from the manager.
   */
  dispose(): void;
}

/**
 * Abstract manager for coordinating multiple highlights.
 * Implementations handle the graphics-specific rendering of multiple overlapping highlights.
 */
export abstract class HighlightManager<G extends GraphicsAdapter = GraphicsAdapter> {
  /**
   * Create a new highlight with optional initial configuration.
   * @param config Optional initial configuration
   * @returns A handle to the created highlight
   */
  abstract createHighlight(config?: HighlightConfig): HighlightHandle<G>;

  /**
   * Get all active highlight handles.
   */
  abstract getHighlights(): HighlightHandle<G>[];

  /**
   * Get a highlight by ID.
   * @param id The highlight ID
   */
  abstract getHighlight(id: string): HighlightHandle<G> | undefined;

  /**
   * Called each frame to update highlight visuals if needed.
   */
  abstract update(): void;

  /**
   * Dispose of all highlights and clean up resources.
   */
  abstract dispose(): void;
}

