import {
  DefaultHighlightConfig,
  HighlightConfig,
  HighlightHandle,
  HighlightManager,
  TransformableElement,
} from "@mml-io/mml-web";
import * as THREE from "three";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

let highlightIdCounter = 0;

/**
 * Generate a unique highlight ID.
 */
function generateHighlightId(): string {
  return `highlight-${++highlightIdCounter}`;
}

/**
 * Normalize a color value to a hex number for comparison.
 */
function normalizeColor(color: number | string | undefined): number {
  if (color === undefined) return DefaultHighlightConfig.color as number;
  if (typeof color === "number") return color;
  return new THREE.Color(color).getHex();
}

/**
 * Create a color key for grouping highlights by visual appearance.
 * Highlights with the same key can share an OutlinePass.
 */
function getConfigKey(config: Required<HighlightConfig>): string {
  const color = normalizeColor(config.color);
  return `${color}-${config.strength}-${config.thickness}-${config.glow}`;
}

/**
 * Internal highlight instance that tracks elements and config.
 */
class ThreeJSHighlightHandle implements HighlightHandle<ThreeJSGraphicsAdapter> {
  readonly id: string;
  private elements: TransformableElement<ThreeJSGraphicsAdapter>[] = [];
  private config: Required<HighlightConfig>;
  private disposed = false;

  constructor(
    private manager: ThreeJSHighlightManager,
    initialConfig?: HighlightConfig,
  ) {
    this.id = generateHighlightId();
    this.config = { ...DefaultHighlightConfig, ...initialConfig };
  }

  setElements(elements: TransformableElement<ThreeJSGraphicsAdapter>[]): void {
    if (this.disposed) return;
    this.elements = [...elements];
    this.manager.markDirty();
  }

  getElements(): TransformableElement<ThreeJSGraphicsAdapter>[] {
    return [...this.elements];
  }

  setConfig(config: HighlightConfig): void {
    if (this.disposed) return;
    this.config = { ...this.config, ...config };
    this.manager.markDirty();
  }

  getConfig(): Required<HighlightConfig> {
    return { ...this.config };
  }

  clear(): void {
    if (this.disposed) return;
    this.elements = [];
    this.manager.markDirty();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.elements = [];
    this.manager.removeHighlight(this);
  }

  /**
   * Get the Three.js objects for this highlight's elements.
   * @internal
   */
  getObjects(): THREE.Object3D[] {
    return this.elements
      .map((el) => el.getContainer() as THREE.Object3D)
      .filter((obj): obj is THREE.Object3D => obj !== null && obj !== undefined);
  }

  /**
   * Get the config key for grouping.
   * @internal
   */
  getConfigKey(): string {
    return getConfigKey(this.config);
  }
}

/**
 * Manages an OutlinePass for a group of highlights sharing the same visual config.
 */
class OutlinePassGroup {
  readonly pass: OutlinePass;
  private objects: THREE.Object3D[] = [];

  constructor(
    private resolution: THREE.Vector2,
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    config: Required<HighlightConfig>,
  ) {
    this.pass = new OutlinePass(resolution, scene, camera);
    this.applyConfig(config);
  }

  applyConfig(config: Required<HighlightConfig>): void {
    const color = normalizeColor(config.color);
    // Use a dimmer color for hidden edges to reduce visual noise (especially for text/labels),
    // while keeping visible edges crisp.
    const visible = new THREE.Color(color);
    const hidden = visible.clone().multiplyScalar(0.35);
    this.pass.visibleEdgeColor.copy(visible);
    this.pass.hiddenEdgeColor.copy(hidden);
    this.pass.edgeStrength = config.strength;
    this.pass.edgeThickness = config.thickness;
    this.pass.edgeGlow = config.glow;
    this.pass.pulsePeriod = 0;
  }

  setObjects(objects: THREE.Object3D[]): void {
    this.objects = objects;
    this.pass.selectedObjects = this.objects;
  }

  hasObjects(): boolean {
    return this.objects.length > 0;
  }

  setSize(width: number, height: number): void {
    this.pass.setSize(width, height);
  }

  setCamera(camera: THREE.Camera): void {
    this.pass.renderCamera = camera;
  }

  dispose(): void {
    this.pass.dispose();
  }
}

/**
 * Listener interface for highlight manager events.
 */
export interface HighlightManagerListener {
  /**
   * Called when the highlight passes have been rebuilt.
   * The renderer should update its composer with the new passes.
   */
  onPassesChanged(passes: OutlinePass[]): void;
}

/**
 * ThreeJS implementation of the highlight manager.
 * Manages multiple independent highlights, grouping them by visual config
 * to share OutlinePasses efficiently.
 */
export class ThreeJSHighlightManager extends HighlightManager<ThreeJSGraphicsAdapter> {
  private highlights = new Map<string, ThreeJSHighlightHandle>();
  private passGroups = new Map<string, OutlinePassGroup>();
  private dirty = true;
  private listener: HighlightManagerListener | null = null;

  constructor(
    private resolution: THREE.Vector2,
    private scene: THREE.Scene,
    private camera: THREE.Camera,
  ) {
    super();
  }

  /**
   * Set a listener to be notified when outline passes change.
   */
  setListener(listener: HighlightManagerListener | null): void {
    this.listener = listener;
  }

  createHighlight(config?: HighlightConfig): HighlightHandle<ThreeJSGraphicsAdapter> {
    const handle = new ThreeJSHighlightHandle(this, config);
    this.highlights.set(handle.id, handle);
    this.markDirty();
    return handle;
  }

  getHighlights(): HighlightHandle<ThreeJSGraphicsAdapter>[] {
    return Array.from(this.highlights.values());
  }

  getHighlight(id: string): HighlightHandle<ThreeJSGraphicsAdapter> | undefined {
    return this.highlights.get(id);
  }

  /**
   * Mark the manager as needing to rebuild passes.
   * @internal
   */
  markDirty(): void {
    this.dirty = true;
  }

  /**
   * Remove a highlight from the manager.
   * @internal
   */
  removeHighlight(handle: ThreeJSHighlightHandle): void {
    this.highlights.delete(handle.id);
    this.markDirty();
  }

  update(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.rebuildPasses();
  }

  /**
   * Get all active outline passes.
   * Useful for integrating with EffectComposer.
   */
  getPasses(): OutlinePass[] {
    return Array.from(this.passGroups.values())
      .filter((group) => group.hasObjects())
      .map((group) => group.pass);
  }

  /**
   * Check if there are any highlighted objects.
   */
  hasHighlightedObjects(): boolean {
    for (const highlight of this.highlights.values()) {
      if (highlight.getObjects().length > 0) return true;
    }
    return false;
  }

  /**
   * Update the camera for all passes.
   */
  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
    for (const group of this.passGroups.values()) {
      group.setCamera(camera);
    }
  }

  /**
   * Update the resolution for all passes.
   */
  setSize(width: number, height: number): void {
    this.resolution.set(width, height);
    for (const group of this.passGroups.values()) {
      group.setSize(width, height);
    }
  }

  dispose(): void {
    for (const highlight of this.highlights.values()) {
      highlight.dispose();
    }
    this.highlights.clear();

    for (const group of this.passGroups.values()) {
      group.dispose();
    }
    this.passGroups.clear();
  }

  /**
   * Rebuild outline passes based on current highlights.
   * Groups highlights by config and creates/updates OutlinePasses accordingly.
   */
  private rebuildPasses(): void {
    // Group objects by config key
    const objectsByConfig = new Map<string, { config: Required<HighlightConfig>; objects: THREE.Object3D[] }>();

    for (const highlight of this.highlights.values()) {
      const objects = highlight.getObjects();
      if (objects.length === 0) continue;

      const key = highlight.getConfigKey();
      const existing = objectsByConfig.get(key);
      if (existing) {
        existing.objects.push(...objects);
      } else {
        objectsByConfig.set(key, {
          config: highlight.getConfig(),
          objects: [...objects],
        });
      }
    }

    // Track which groups are still in use
    const usedKeys = new Set<string>();

    // Create/update pass groups
    for (const [key, { config, objects }] of objectsByConfig) {
      usedKeys.add(key);

      let group = this.passGroups.get(key);
      if (!group) {
        group = new OutlinePassGroup(this.resolution, this.scene, this.camera, config);
        this.passGroups.set(key, group);
      } else {
        group.applyConfig(config);
      }
      group.setObjects(objects);
    }

    // Remove unused pass groups
    for (const [key, group] of this.passGroups) {
      if (!usedKeys.has(key)) {
        group.dispose();
        this.passGroups.delete(key);
      }
    }

    // Notify listener that passes may have changed
    if (this.listener) {
      this.listener.onPassesChanged(this.getPasses());
    }
  }
}

