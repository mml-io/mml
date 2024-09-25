import { Frame } from "mml-web";
import { FrameGraphics } from "mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

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

export class ThreeJSFrame extends FrameGraphics<ThreeJSGraphicsAdapter> {
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
  private static DebugUnloadRangeMaterial = new THREE.MeshBasicMaterial({
    color: 0x0000ff,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });

  private debugMeshes: {
    debugBoxConstraintMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    debugBoxLoadRangeMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    debugBoxUnloadRangeMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  } | null = null;

  constructor(private frame: Frame<ThreeJSGraphicsAdapter>) {
    super(frame);
  }

  setSrc() {
    // no-op
  }

  setDebug(): void {
    this.updateDebugVisualisation();
  }
  setLoadRange(): void {
    this.updateDebugVisualisation();
  }
  setUnloadRange(): void {
    this.updateDebugVisualisation();
  }
  setMinX(): void {
    this.updateDebugVisualisation();
  }
  setMaxX(): void {
    this.updateDebugVisualisation();
  }
  setMinY(): void {
    this.updateDebugVisualisation();
  }
  setMaxY(): void {
    this.updateDebugVisualisation();
  }
  setMinZ(): void {
    this.updateDebugVisualisation();
  }
  setMaxZ(): void {
    this.updateDebugVisualisation();
  }

  disable(): void {}

  enable(): void {}

  dispose() {}

  private clearDebugVisualisation() {
    if (this.debugMeshes) {
      this.debugMeshes.debugBoxConstraintMesh.removeFromParent();
      this.debugMeshes.debugBoxLoadRangeMesh.removeFromParent();
      this.debugMeshes.debugBoxUnloadRangeMesh.removeFromParent();
      this.debugMeshes = null;
    }
  }

  private updateDebugVisualisation() {
    if (!this.frame.props.debug) {
      this.clearDebugVisualisation();
    } else {
      if (!this.frame.isConnected) {
        return;
      }
      if (!this.debugMeshes) {
        this.debugMeshes = {
          debugBoxConstraintMesh: new THREE.Mesh(
            ThreeJSFrame.DebugBoxGeometry,
            ThreeJSFrame.DebugConstraintMaterial,
          ),
          debugBoxLoadRangeMesh: new THREE.Mesh(
            ThreeJSFrame.DebugBoxGeometry,
            ThreeJSFrame.DebugLoadRangeMaterial,
          ),
          debugBoxUnloadRangeMesh: new THREE.Mesh(
            ThreeJSFrame.DebugBoxGeometry,
            ThreeJSFrame.DebugUnloadRangeMaterial,
          ),
        };
        this.frame.getContainer().add(this.debugMeshes.debugBoxConstraintMesh);
        this.frame.getContainer().add(this.debugMeshes.debugBoxLoadRangeMesh);
        this.frame.getContainer().add(this.debugMeshes.debugBoxUnloadRangeMesh);
      }

      let boxBounds = this.frame.getDefinedBoxBounds();
      if (!boxBounds) {
        boxBounds = [0, 0, 0, 0, 0, 0];
      }

      const [minX, maxX, minY, maxY, minZ, maxZ] = boxBounds;
      this.debugMeshes.debugBoxConstraintMesh.visible = true;
      this.debugMeshes.debugBoxLoadRangeMesh.visible = true;
      this.debugMeshes.debugBoxUnloadRangeMesh.visible = true;

      setMeshToBoundingBox(
        this.debugMeshes.debugBoxConstraintMesh,
        minX,
        maxX,
        minY,
        maxY,
        minZ,
        maxZ,
      );

      if (this.frame.props.loadRange === null) {
        this.debugMeshes.debugBoxLoadRangeMesh.visible = false;
        this.debugMeshes.debugBoxUnloadRangeMesh.visible = false;
      } else {
        this.debugMeshes.debugBoxLoadRangeMesh.visible = true;
        this.debugMeshes.debugBoxUnloadRangeMesh.visible = true;

        setMeshToBoundingBox(
          this.debugMeshes.debugBoxLoadRangeMesh,
          minX - this.frame.props.loadRange,
          maxX + this.frame.props.loadRange,
          minY - this.frame.props.loadRange,
          maxY + this.frame.props.loadRange,
          minZ - this.frame.props.loadRange,
          maxZ + this.frame.props.loadRange,
        );

        setMeshToBoundingBox(
          this.debugMeshes.debugBoxUnloadRangeMesh,
          minX - this.frame.props.loadRange - this.frame.props.unloadRange,
          maxX + this.frame.props.loadRange + this.frame.props.unloadRange,
          minY - this.frame.props.loadRange - this.frame.props.unloadRange,
          maxY + this.frame.props.loadRange + this.frame.props.unloadRange,
          minZ - this.frame.props.loadRange - this.frame.props.unloadRange,
          maxZ + this.frame.props.loadRange + this.frame.props.unloadRange,
        );
      }
    }
  }
}
