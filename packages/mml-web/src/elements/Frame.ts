import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import { AttributeHandler, parseFloatAttribute } from "../utils/attribute-handling";
import { StaticHTMLFrameInstance } from "../utils/frame/StaticHTMLFrameInstance";
import { WebSocketFrameInstance } from "../utils/frame/WebSocketFrameInstance";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";
import { getRelativePositionAndRotationRelativeToObject } from "../utils/position-utils";

const defaultUnloadThreshold = 1;
const defaultFrameDebug = false;

function setMeshToBoundingBox(
  mesh: THREE.Mesh,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number,
) {
  mesh.scale.set(maxX - minX, maxY - minY, maxZ - minZ);
  mesh.position.set((maxX + minX) / 2, (maxY + minY) / 2, (maxZ + minZ) / 2);
}

export class Frame extends TransformableElement {
  static tagName = "m-frame";

  private static attributeHandler = new AttributeHandler<Frame>({
    src: (instance, newValue) => {
      instance.props.src = newValue;
      if (instance.frameContentsInstance) {
        instance.disposeInstance();
      }
      if (instance.props.src && instance.isConnected) {
        instance.createFrameContentsInstance(instance.props.src);
      }
    },
    "load-range": (instance, newValue) => {
      instance.props.loadRange = parseFloatAttribute(newValue, null);
      instance.syncLoadState();
      instance.updateDebugVisualisation();
    },
    "unload-threshold": (instance, newValue) => {
      instance.props.unloadThreshold = parseFloatAttribute(newValue, defaultUnloadThreshold);
      instance.syncLoadState();
      instance.updateDebugVisualisation();
    },
    debug: (instance, newValue) => {
      instance.props.debug = newValue !== null;
      instance.updateDebugVisualisation();
    },
    "min-x": (instance, newValue) => {
      instance.props.minX = parseFloatAttribute(newValue, null);
      instance.boundsUpdated();
    },
    "max-x": (instance, newValue) => {
      instance.props.maxX = parseFloatAttribute(newValue, null);
      instance.boundsUpdated();
    },
    "min-y": (instance, newValue) => {
      instance.props.minY = parseFloatAttribute(newValue, null);
      instance.boundsUpdated();
    },
    "max-y": (instance, newValue) => {
      instance.props.maxY = parseFloatAttribute(newValue, null);
      instance.boundsUpdated();
    },
    "min-z": (instance, newValue) => {
      instance.props.minZ = parseFloatAttribute(newValue, null);
      instance.boundsUpdated();
    },
    "max-z": (instance, newValue) => {
      instance.props.maxZ = parseFloatAttribute(newValue, null);
      instance.boundsUpdated();
    },
  });

  private frameContentsInstance: WebSocketFrameInstance | StaticHTMLFrameInstance | null = null;
  private isActivelyLoaded = false;
  private timer: NodeJS.Timeout | null = null;

  private boundsUpdated() {
    this.updateDebugVisualisation();
    const boxBounds = this.getDefinedBoxBounds();
    if (boxBounds) {
      const [minX, maxX, minY, maxY, minZ, maxZ] = boxBounds;
      const obb = OrientedBoundingBox.fromSizeMatrixWorldProviderAndCenter(
        new THREE.Vector3(maxX - minX, maxY - minY, maxZ - minZ),
        this.container,
        new THREE.Vector3((maxX + minX) / 2, (maxY + minY) / 2, (maxZ + minZ) / 2),
      );
      this.addOrUpdateParentBound(this, obb);
    } else {
      this.removeParentBound(this);
    }
  }

  private props = {
    src: null as string | null,
    loadRange: null as number | null,
    unloadThreshold: defaultUnloadThreshold as number,

    debug: defaultFrameDebug,

    minX: null as number | null,
    maxX: null as number | null,
    minY: null as number | null,
    maxY: null as number | null,
    minZ: null as number | null,
    maxZ: null as number | null,
  };

  private static DebugSphereGeometry = new THREE.SphereGeometry(1, 16, 16, 1);
  private static DebugBoxGeometry = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  private static DebugConstraintMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });
  private static DebugLoadRangeMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });
  private static DebugThresholdMaterial = new THREE.MeshBasicMaterial({
    color: 0x0000ff,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });

  private debugMeshes: {
    debugBoxConstraintMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    debugBoxLoadRangeMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    debugBoxThresholdMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;

    debugSphereLoadRangeMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
    debugSphereThresholdMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  } | null = null;

  private shouldBeLoaded() {
    if (!this.isConnected) {
      return false;
    }
    if (this.props.loadRange === null) {
      return true;
    }

    const userPositionAndRotation = this.getUserPositionAndRotation();
    const elementRelative = getRelativePositionAndRotationRelativeToObject(
      userPositionAndRotation,
      this.getContainer(),
    );

    const boxBounds = this.getDefinedBoxBounds();
    if (boxBounds) {
      // This frame has defined box bounds, check if the user position is within the bounds
      const [minX, maxX, minY, maxY, minZ, maxZ] = boxBounds;
      if (
        elementRelative.position.x >= minX - this.props.loadRange &&
        elementRelative.position.x <= maxX + this.props.loadRange &&
        elementRelative.position.y >= minY - this.props.loadRange &&
        elementRelative.position.y <= maxY + this.props.loadRange &&
        elementRelative.position.z >= minZ - this.props.loadRange &&
        elementRelative.position.z <= maxZ + this.props.loadRange
      ) {
        return true;
      }
      // If the user is within the unload-threshold range, keep the current state
      if (
        elementRelative.position.x >= minX - this.props.loadRange - this.props.unloadThreshold &&
        elementRelative.position.x <= maxX + this.props.loadRange + this.props.unloadThreshold &&
        elementRelative.position.y >= minY - this.props.loadRange - this.props.unloadThreshold &&
        elementRelative.position.y <= maxY + this.props.loadRange + this.props.unloadThreshold &&
        elementRelative.position.z >= minZ - this.props.loadRange - this.props.unloadThreshold &&
        elementRelative.position.z <= maxZ + this.props.loadRange + this.props.unloadThreshold
      ) {
        return this.isActivelyLoaded;
      }
    } else {
      // Check if the position is within spherical range
      const distance = new THREE.Vector3().copy(elementRelative.position as THREE.Vector3).length();
      if (distance <= this.props.loadRange) {
        return true;
      }
      if (distance > this.props.loadRange + this.props.unloadThreshold) {
        return false;
      }
      // If the distance is within the unload-threshold range, keep the current state
      return this.isActivelyLoaded;
    }
  }

  private syncLoadState() {
    const shouldBeLoaded = this.shouldBeLoaded();
    if (shouldBeLoaded && !this.isActivelyLoaded) {
      this.isActivelyLoaded = true;
      if (this.props.src) {
        this.createFrameContentsInstance(this.props.src);
      }
    } else if (!shouldBeLoaded && this.isActivelyLoaded) {
      this.isActivelyLoaded = false;
      this.disposeInstance();
    }
  }

  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes, ...Frame.attributeHandler.getAttributes()];
  }

  constructor() {
    super();
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return null;
  }

  public parentTransformed(): void {
    this.boundsUpdated();
  }

  public isClickable(): boolean {
    return true;
  }

  connectedCallback() {
    super.connectedCallback();
    this.updateDebugVisualisation();
    this.startEmitting();
    this.syncLoadState();
  }

  disconnectedCallback() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.clearDebugVisualisation();
    this.disposeInstance();
    super.disconnectedCallback();
  }

  private startEmitting() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      this.syncLoadState();
    }, 100);
  }

  private createFrameContentsInstance(src: string) {
    if (this.frameContentsInstance) {
      if (this.frameContentsInstance.src !== src) {
        console.error("Instance already existed with a different src");
        this.disposeInstance();
      } else {
        return;
      }
    }

    if (src.startsWith("ws://") || src.startsWith("wss://")) {
      this.frameContentsInstance = new WebSocketFrameInstance(this, src, this.getScene());
    } else {
      this.frameContentsInstance = new StaticHTMLFrameInstance(this, src, this.getScene());
    }
    this.container.add(this.frameContentsInstance.container);
  }

  private clearDebugVisualisation() {
    if (this.debugMeshes) {
      this.debugMeshes.debugBoxConstraintMesh.removeFromParent();
      this.debugMeshes.debugBoxLoadRangeMesh.removeFromParent();
      this.debugMeshes.debugBoxThresholdMesh.removeFromParent();
      this.debugMeshes = null;
    }
  }

  private getDefinedBoxBounds(): [number, number, number, number, number, number] | null {
    if (
      this.props.minX !== null ||
      this.props.maxX !== null ||
      this.props.minY !== null ||
      this.props.maxY !== null ||
      this.props.minZ !== null ||
      this.props.maxZ !== null
    ) {
      const minX = this.props.minX ?? this.props.maxX ?? 0;
      let maxX = this.props.maxX ?? this.props.minX ?? 0;
      const minY = this.props.minY ?? this.props.maxY ?? 0;
      let maxY = this.props.maxY ?? this.props.minY ?? 0;
      const minZ = this.props.minZ ?? this.props.maxZ ?? 0;
      let maxZ = this.props.maxZ ?? this.props.minZ ?? 0;
      // If any bounds are incorrect make them equal (and therefore not able to contain anything, but visually debuggable)
      if (minX > maxX) {
        maxX = minX;
      }
      if (minY > maxY) {
        maxY = minY;
      }
      if (minZ > maxZ) {
        maxZ = minZ;
      }
      return [minX, maxX, minY, maxY, minZ, maxZ];
    }
    return null;
  }

  private updateDebugVisualisation() {
    if (!this.props.debug) {
      this.clearDebugVisualisation();
    } else {
      if (!this.isConnected) {
        return;
      }
      if (!this.debugMeshes) {
        this.debugMeshes = {
          debugBoxConstraintMesh: new THREE.Mesh(
            Frame.DebugBoxGeometry,
            Frame.DebugConstraintMaterial,
          ),
          debugBoxLoadRangeMesh: new THREE.Mesh(
            Frame.DebugBoxGeometry,
            Frame.DebugLoadRangeMaterial,
          ),
          debugBoxThresholdMesh: new THREE.Mesh(
            Frame.DebugBoxGeometry,
            Frame.DebugThresholdMaterial,
          ),
          debugSphereLoadRangeMesh: new THREE.Mesh(
            Frame.DebugSphereGeometry,
            Frame.DebugLoadRangeMaterial,
          ),
          debugSphereThresholdMesh: new THREE.Mesh(
            Frame.DebugSphereGeometry,
            Frame.DebugThresholdMaterial,
          ),
        };
        this.container.add(
          this.debugMeshes.debugBoxConstraintMesh,
          this.debugMeshes.debugBoxLoadRangeMesh,
          this.debugMeshes.debugBoxThresholdMesh,
          this.debugMeshes.debugSphereLoadRangeMesh,
          this.debugMeshes.debugSphereThresholdMesh,
        );
      }

      const boxBounds = this.getDefinedBoxBounds();
      if (!boxBounds) {
        // Use spherical load range (if load range is defined)
        if (this.props.loadRange !== null) {
          this.debugMeshes.debugBoxConstraintMesh.visible = false;
          this.debugMeshes.debugBoxLoadRangeMesh.visible = false;
          this.debugMeshes.debugBoxThresholdMesh.visible = false;
          this.debugMeshes.debugSphereLoadRangeMesh.visible = true;
          this.debugMeshes.debugSphereThresholdMesh.visible = true;
          this.debugMeshes.debugSphereLoadRangeMesh.scale.set(
            this.props.loadRange,
            this.props.loadRange,
            this.props.loadRange,
          );
          this.debugMeshes.debugSphereThresholdMesh.scale.set(
            this.props.loadRange + this.props.unloadThreshold,
            this.props.loadRange + this.props.unloadThreshold,
            this.props.loadRange + this.props.unloadThreshold,
          );
        } else {
          this.debugMeshes.debugBoxConstraintMesh.visible = false;
          this.debugMeshes.debugBoxLoadRangeMesh.visible = false;
          this.debugMeshes.debugBoxThresholdMesh.visible = false;
          this.debugMeshes.debugSphereLoadRangeMesh.visible = false;
          this.debugMeshes.debugSphereThresholdMesh.visible = false;
        }
      } else {
        const [minX, maxX, minY, maxY, minZ, maxZ] = boxBounds;
        this.debugMeshes.debugBoxConstraintMesh.visible = true;
        this.debugMeshes.debugBoxLoadRangeMesh.visible = true;
        this.debugMeshes.debugBoxThresholdMesh.visible = true;
        this.debugMeshes.debugSphereLoadRangeMesh.visible = false;
        this.debugMeshes.debugSphereThresholdMesh.visible = false;

        setMeshToBoundingBox(
          this.debugMeshes.debugBoxConstraintMesh,
          minX,
          maxX,
          minY,
          maxY,
          minZ,
          maxZ,
        );

        if (this.props.loadRange === null) {
          this.debugMeshes.debugBoxLoadRangeMesh.visible = false;
          this.debugMeshes.debugBoxThresholdMesh.visible = false;
        } else {
          this.debugMeshes.debugBoxLoadRangeMesh.visible = true;
          this.debugMeshes.debugBoxThresholdMesh.visible = true;

          setMeshToBoundingBox(
            this.debugMeshes.debugBoxLoadRangeMesh,
            minX - this.props.loadRange,
            maxX + this.props.loadRange,
            minY - this.props.loadRange,
            maxY + this.props.loadRange,
            minZ - this.props.loadRange,
            maxZ + this.props.loadRange,
          );

          setMeshToBoundingBox(
            this.debugMeshes.debugBoxThresholdMesh,
            minX - this.props.loadRange - this.props.unloadThreshold,
            maxX + this.props.loadRange + this.props.unloadThreshold,
            minY - this.props.loadRange - this.props.unloadThreshold,
            maxY + this.props.loadRange + this.props.unloadThreshold,
            minZ - this.props.loadRange - this.props.unloadThreshold,
            maxZ + this.props.loadRange + this.props.unloadThreshold,
          );
        }
      }
    }
  }

  private disposeInstance() {
    if (this.frameContentsInstance !== null) {
      this.container.remove(this.frameContentsInstance.container);
      this.frameContentsInstance.dispose();
      this.frameContentsInstance = null;
    }
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Frame.attributeHandler.handle(this, name, newValue);
  }
}
