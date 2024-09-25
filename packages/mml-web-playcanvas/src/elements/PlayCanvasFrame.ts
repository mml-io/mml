import { Frame, FrameGraphics } from "mml-web";
import * as playcanvas from "playcanvas";

import { createPlayCanvasDebugBoundingBox } from "../debug-bounding-box/PlayCanvasDebugBoundingBox";
import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

function setEntityToBoundingBox(
  debugBoxConstraintMesh: playcanvas.Entity,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number,
) {
  debugBoxConstraintMesh.setLocalPosition((maxX + minX) / 2, (maxY + minY) / 2, (maxZ + minZ) / 2);
  debugBoxConstraintMesh.setLocalScale(-(maxX - minX), maxY - minY, maxZ - minZ);
}

export class PlayCanvasFrame extends FrameGraphics<PlayCanvasGraphicsAdapter> {
  private debugMaterial: playcanvas.BasicMaterial | null = null;
  private loadRangeMaterial: playcanvas.BasicMaterial | null = null;
  private unloadRangeMaterial: playcanvas.BasicMaterial | null = null;

  private debugMeshes: {
    debugBoxConstraintMesh: playcanvas.Entity;
    debugBoxLoadRangeMesh: playcanvas.Entity;
    debugBoxUnloadRangeMesh: playcanvas.Entity;
  } | null = null;

  constructor(private frame: Frame<PlayCanvasGraphicsAdapter>) {
    super(frame);
    this.updateDebugVisualisation();
  }

  setSrc(): void {
    // no-op
  }

  public setDebug(): void {
    this.updateDebugVisualisation();
  }
  public setLoadRange(): void {
    this.updateDebugVisualisation();
  }
  public setUnloadRange(): void {
    this.updateDebugVisualisation();
  }
  public setMinX(): void {
    this.updateDebugVisualisation();
  }
  public setMaxX(): void {
    this.updateDebugVisualisation();
  }
  public setMinY(): void {
    this.updateDebugVisualisation();
  }
  public setMaxY(): void {
    this.updateDebugVisualisation();
  }
  public setMinZ(): void {
    this.updateDebugVisualisation();
  }
  public setMaxZ(): void {
    this.updateDebugVisualisation();
  }

  disable(): void {}

  enable(): void {}

  dispose() {
    this.clearDebugVisualisation();
  }

  private clearDebugVisualisation() {
    if (this.debugMeshes) {
      this.debugMeshes.debugBoxConstraintMesh.destroy();
      this.debugMeshes.debugBoxLoadRangeMesh.destroy();
      this.debugMeshes.debugBoxUnloadRangeMesh.destroy();
      this.debugMeshes = null;
    }
    if (this.debugMaterial) {
      this.debugMaterial.destroy();
      this.debugMaterial = null;
    }
    if (this.loadRangeMaterial) {
      this.loadRangeMaterial.destroy();
      this.loadRangeMaterial = null;
    }
    if (this.unloadRangeMaterial) {
      this.unloadRangeMaterial.destroy();
      this.unloadRangeMaterial = null;
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
        if (!this.debugMaterial) {
          this.debugMaterial = new playcanvas.BasicMaterial();
          this.debugMaterial.color = new playcanvas.Color(1, 0, 0);
        }
        if (!this.loadRangeMaterial) {
          this.loadRangeMaterial = new playcanvas.BasicMaterial();
          this.loadRangeMaterial.color = new playcanvas.Color(0, 1, 0);
        }
        if (!this.unloadRangeMaterial) {
          this.unloadRangeMaterial = new playcanvas.BasicMaterial();
          this.unloadRangeMaterial.color = new playcanvas.Color(0, 0, 1);
        }
        const graphicsAdapter = this.frame.getScene().getGraphicsAdapter();
        this.debugMeshes = {
          debugBoxConstraintMesh: createPlayCanvasDebugBoundingBox(
            graphicsAdapter,
            this.debugMaterial,
          ),
          debugBoxLoadRangeMesh: createPlayCanvasDebugBoundingBox(
            graphicsAdapter,
            this.loadRangeMaterial,
          ),
          debugBoxUnloadRangeMesh: createPlayCanvasDebugBoundingBox(
            graphicsAdapter,
            this.unloadRangeMaterial,
          ),
        };
        this.frame.getContainer().addChild(this.debugMeshes.debugBoxConstraintMesh);
        this.frame.getContainer().addChild(this.debugMeshes.debugBoxLoadRangeMesh);
        this.frame.getContainer().addChild(this.debugMeshes.debugBoxUnloadRangeMesh);
      }

      let boxBounds = this.frame.getDefinedBoxBounds();
      if (!boxBounds) {
        boxBounds = [0, 0, 0, 0, 0, 0];
      }

      const [minX, maxX, minY, maxY, minZ, maxZ] = boxBounds;
      this.debugMeshes.debugBoxConstraintMesh.enabled = true;

      setEntityToBoundingBox(
        this.debugMeshes.debugBoxConstraintMesh,
        minX,
        maxX,
        minY,
        maxY,
        minZ,
        maxZ,
      );

      if (this.frame.props.loadRange === null) {
        this.debugMeshes.debugBoxLoadRangeMesh.enabled = false;
        this.debugMeshes.debugBoxUnloadRangeMesh.enabled = false;
      } else {
        this.debugMeshes.debugBoxLoadRangeMesh.enabled = true;
        this.debugMeshes.debugBoxUnloadRangeMesh.enabled = true;

        setEntityToBoundingBox(
          this.debugMeshes.debugBoxLoadRangeMesh,
          minX - this.frame.props.loadRange,
          maxX + this.frame.props.loadRange,
          minY - this.frame.props.loadRange,
          maxY + this.frame.props.loadRange,
          minZ - this.frame.props.loadRange,
          maxZ + this.frame.props.loadRange,
        );

        setEntityToBoundingBox(
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
