import {
  TransformableElement,
  TransformMode,
  TransformSnapping,
  TransformSpace,
  TransformValues,
  TransformWidgetCallbacks,
  TransformWidgetGraphics,
} from "@mml-io/mml-web";
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

/**
 * ThreeJS implementation of transform widget graphics.
 * Wraps THREE.TransformControls to provide translate/rotate/scale gizmos.
 */
export class ThreeJSTransformWidget extends TransformWidgetGraphics<ThreeJSGraphicsAdapter> {
  private transformControls: TransformControls;
  private attachedElements: TransformableElement<ThreeJSGraphicsAdapter>[] = [];

  // Multi-selection support
  private multiSelectionPivot: THREE.Object3D | null = null;
  private selectedContainers: THREE.Object3D[] = [];
  private multiRelativeMatrices: Map<THREE.Object3D, THREE.Matrix4> = new Map();

  private currentMode: TransformMode = "translate";
  private currentSpace: TransformSpace = "local";
  private snappingConfig: TransformSnapping = {
    translation: 0.1,
    rotation: 10,
    scale: 0.25,
  };
  private snappingEnabled: boolean = false;
  private dragging: boolean = false;
  private widgetEnabled: boolean = true;
  private callbacks: TransformWidgetCallbacks = {};

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private domElement: HTMLElement,
    private overlayScene?: THREE.Scene,
  ) {
    super();

    this.transformControls = new TransformControls(camera, domElement);
    this.setupGizmoColors();

    // Add to overlay scene if available, otherwise main scene
    const targetScene = overlayScene ?? scene;
    const helper = this.transformControls.getHelper();
    targetScene.add(helper);

    this.setupEventListeners();
  }

  attach(
    elements: TransformableElement<ThreeJSGraphicsAdapter>[],
  ): void {
    if (!this.widgetEnabled || elements.length === 0) {
      this.detach();
      return;
    }

    this.attachedElements = elements;

    // Cache selected containers
    this.selectedContainers = elements
      .map((e) => e.getContainer() as THREE.Object3D)
      .filter((c): c is THREE.Object3D => c !== null && c !== undefined);

    if (this.selectedContainers.length === 0) {
      this.detach();
      return;
    }

    if (this.selectedContainers.length > 1) {
      // Multi-selection: create or update pivot
      this.setupMultiSelectionPivot();
      this.transformControls.attach(this.multiSelectionPivot!);
    } else {
      // Single selection: attach directly
      this.cleanupMultiSelectionPivot();
      this.transformControls.attach(this.selectedContainers[0]);
    }
  }

  detach(): void {
    this.transformControls.detach();
    this.attachedElements = [];
    this.selectedContainers = [];
    this.cleanupMultiSelectionPivot();
  }

  setMode(mode: TransformMode): void {
    this.currentMode = mode;
    this.transformControls.setMode(mode);
  }

  getMode(): TransformMode {
    return this.currentMode;
  }

  setSpace(space: TransformSpace): void {
    this.currentSpace = space;
    this.transformControls.setSpace(space);
  }

  getSpace(): TransformSpace {
    return this.currentSpace;
  }

  toggleSpace(): void {
    this.currentSpace = this.currentSpace === "local" ? "world" : "local";
    this.transformControls.setSpace(this.currentSpace);
  }

  setSnapping(snapping: TransformSnapping): void {
    this.snappingConfig = { ...this.snappingConfig, ...snapping };
    this.applySnapping();
  }

  setSnappingEnabled(enabled: boolean): void {
    this.snappingEnabled = enabled;
    this.applySnapping();
  }

  setSize(size: number): void {
    this.transformControls.setSize(size);
  }

  setAxisVisibility(showX: boolean, showY: boolean, showZ: boolean): void {
    this.transformControls.showX = showX;
    this.transformControls.showY = showY;
    this.transformControls.showZ = showZ;
  }

  setCallbacks(callbacks: TransformWidgetCallbacks): void {
    this.callbacks = callbacks;
  }

  isDragging(): boolean {
    return this.dragging;
  }

  enable(): void {
    this.widgetEnabled = true;
    this.transformControls.enabled = true;
  }

  disable(): void {
    this.widgetEnabled = false;
    this.detach();
    this.transformControls.enabled = false;
  }

  dispose(): void {
    this.detach();
    const helper = this.transformControls.getHelper();
    helper.parent?.remove(helper);
    this.transformControls.dispose();
  }

  private setupEventListeners(): void {
    this.transformControls.addEventListener("dragging-changed", (event) => {
      const isDragging = event.value as boolean;
      this.dragging = isDragging;

      if (isDragging) {
        this.callbacks.onDragStart?.();
        this.callbacks.onControlsStateChange?.(false);

        // Prepare multi-selection drag
        if (this.selectedContainers.length > 1 && this.multiSelectionPivot) {
          this.snapshotMultiSelectionRelativeMatrices();
        }
      } else {
        this.callbacks.onControlsStateChange?.(true);

        // Emit transform commit for all elements
        this.emitTransformCommit();
      }
    });

    this.transformControls.addEventListener("change", () => {
      if (!this.dragging) return;

      // Apply pivot transform to all selected containers during multi-drag
      if (
        this.selectedContainers.length > 1 &&
        this.multiSelectionPivot &&
        this.multiRelativeMatrices.size > 0
      ) {
        this.applyMultiSelectionTransform();
      }

      this.emitTransformPreview();
    });
  }

  private setupGizmoColors(): void {
    const x = "#F44336";
    const y = "#45B94C";
    const z = "#377BFF";

    const helper = this.transformControls.getHelper();
    const gizmo = helper.children[0];
    if (!gizmo) return;

    // Red for X
    gizmo.getObjectsByProperty("name", "X").forEach((mesh: any) => {
      if (mesh.material?.color) mesh.material.color = new THREE.Color(x);
    });
    gizmo.getObjectsByProperty("name", "YZ").forEach((mesh: any) => {
      if (mesh.material?.color) mesh.material.color = new THREE.Color(x);
    });

    // Green for Y
    gizmo.getObjectsByProperty("name", "Y").forEach((mesh: any) => {
      if (mesh.material?.color) mesh.material.color = new THREE.Color(y);
    });
    gizmo.getObjectsByProperty("name", "XZ").forEach((mesh: any) => {
      if (mesh.material?.color) mesh.material.color = new THREE.Color(y);
    });

    // Blue for Z
    gizmo.getObjectsByProperty("name", "Z").forEach((mesh: any) => {
      if (mesh.material?.color) mesh.material.color = new THREE.Color(z);
    });
    gizmo.getObjectsByProperty("name", "XY").forEach((mesh: any) => {
      if (mesh.material?.color) mesh.material.color = new THREE.Color(z);
    });
  }

  private applySnapping(): void {
    if (this.snappingEnabled) {
      this.transformControls.setTranslationSnap(this.snappingConfig.translation ?? null);
      this.transformControls.setRotationSnap(
        this.snappingConfig.rotation !== null && this.snappingConfig.rotation !== undefined
          ? THREE.MathUtils.degToRad(this.snappingConfig.rotation)
          : null,
      );
      this.transformControls.setScaleSnap(this.snappingConfig.scale ?? null);
    } else {
      this.transformControls.setTranslationSnap(null);
      this.transformControls.setRotationSnap(null);
      this.transformControls.setScaleSnap(null);
    }
  }

  private setupMultiSelectionPivot(): void {
    if (!this.multiSelectionPivot) {
      this.multiSelectionPivot = new THREE.Object3D();
      this.scene.add(this.multiSelectionPivot);
    }

    // Position pivot at average world position of selected containers
    const center = new THREE.Vector3();
    const tmp = new THREE.Vector3();

    this.selectedContainers.forEach((c) => {
      c.getWorldPosition(tmp);
      center.add(tmp);
    });
    center.multiplyScalar(1 / this.selectedContainers.length);

    this.multiSelectionPivot.position.copy(center);
    this.multiSelectionPivot.quaternion.identity();
    this.multiSelectionPivot.scale.set(1, 1, 1);
    this.multiSelectionPivot.updateMatrixWorld(true);
  }

  private cleanupMultiSelectionPivot(): void {
    if (this.multiSelectionPivot) {
      this.multiSelectionPivot.parent?.remove(this.multiSelectionPivot);
      this.multiSelectionPivot = null;
    }
    this.multiRelativeMatrices.clear();
  }

  private snapshotMultiSelectionRelativeMatrices(): void {
    if (!this.multiSelectionPivot) return;

    this.multiRelativeMatrices.clear();
    this.multiSelectionPivot.updateMatrixWorld(true);
    const pivotInverse = this.multiSelectionPivot.matrixWorld.clone().invert();

    this.selectedContainers.forEach((container) => {
      container.updateMatrixWorld(true);
      const relative = new THREE.Matrix4().multiplyMatrices(pivotInverse, container.matrixWorld);
      this.multiRelativeMatrices.set(container, relative);
    });
  }

  private applyMultiSelectionTransform(): void {
    if (!this.multiSelectionPivot) return;

    this.multiSelectionPivot.updateMatrixWorld(true);

    this.selectedContainers.forEach((container) => {
      const relative = this.multiRelativeMatrices.get(container);
      if (!relative) return;

      // world = pivotWorld * relative
      const targetWorld = new THREE.Matrix4().multiplyMatrices(
        this.multiSelectionPivot!.matrixWorld,
        relative,
      );

      // local = parentWorld^{-1} * world
      const parentWorld = container.parent ? container.parent.matrixWorld : new THREE.Matrix4();
      const parentWorldInv = parentWorld.clone().invert();
      const local = new THREE.Matrix4().multiplyMatrices(parentWorldInv, targetWorld);

      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scl = new THREE.Vector3();
      local.decompose(pos, quat, scl);

      container.position.copy(pos);
      container.quaternion.copy(quat);
      container.scale.copy(scl);
      container.updateMatrix();
      container.updateMatrixWorld(true);
    });
  }

  private emitTransformCommit(): void {
    console.log("[ThreeJSTransformWidget] emitTransformCommit called");
    console.log("[ThreeJSTransformWidget] Has onDragEnd callback:", !!this.callbacks.onDragEnd);
    
    if (!this.callbacks.onDragEnd) {
      console.warn("[ThreeJSTransformWidget] No onDragEnd callback set!");
      return;
    }

    const round = (num: number) => Math.round(num * 1000) / 1000;

    this.attachedElements.forEach((element) => {
      const container = element.getContainer() as THREE.Object3D | undefined;
      if (!container) {
        console.warn("[ThreeJSTransformWidget] Element has no container");
        return;
      }

      const pos = container.position;
      const rot = container.rotation;
      const scale = container.scale;

      const values: TransformValues = {
        x: pos.x === 0.0 ? undefined : round(pos.x),
        y: pos.y === 0.0 ? undefined : round(pos.y),
        z: pos.z === 0.0 ? undefined : round(pos.z),
        rx: rot.x === 0.0 ? undefined : round(THREE.MathUtils.RAD2DEG * rot.x),
        ry: rot.y === 0.0 ? undefined : round(THREE.MathUtils.RAD2DEG * rot.y),
        rz: rot.z === 0.0 ? undefined : round(THREE.MathUtils.RAD2DEG * rot.z),
        sx: scale.x === 1.0 ? undefined : round(scale.x),
        sy: scale.y === 1.0 ? undefined : round(scale.y),
        sz: scale.z === 1.0 ? undefined : round(scale.z),
      };

      console.log("[ThreeJSTransformWidget] Emitting values:", values);
      this.callbacks.onDragEnd!(element, values);
    });
  }

  private emitTransformPreview(): void {
    if (!this.callbacks.onDragChange) {
      return;
    }

    const round = (num: number) => Math.round(num * 1000) / 1000;

    this.attachedElements.forEach((element) => {
      const container = element.getContainer() as THREE.Object3D | undefined;
      if (!container) {
        return;
      }

      const pos = container.position;
      const rot = container.rotation;
      const scale = container.scale;

      const values: TransformValues = {
        x: pos.x === 0.0 ? undefined : round(pos.x),
        y: pos.y === 0.0 ? undefined : round(pos.y),
        z: pos.z === 0.0 ? undefined : round(pos.z),
        rx: rot.x === 0.0 ? undefined : round(THREE.MathUtils.RAD2DEG * rot.x),
        ry: rot.y === 0.0 ? undefined : round(THREE.MathUtils.RAD2DEG * rot.y),
        rz: rot.z === 0.0 ? undefined : round(THREE.MathUtils.RAD2DEG * rot.z),
        sx: scale.x === 1.0 ? undefined : round(scale.x),
        sy: scale.y === 1.0 ? undefined : round(scale.y),
        sz: scale.z === 1.0 ? undefined : round(scale.z),
      };

      this.callbacks.onDragChange?.(element, values);
    });
  }
}

