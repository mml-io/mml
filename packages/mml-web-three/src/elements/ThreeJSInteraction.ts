import { Interaction } from "mml-web";
import { InteractionGraphics } from "mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export class ThreeJSInteraction extends InteractionGraphics<ThreeJSGraphicsAdapter> {
  private static DebugGeometry = new THREE.SphereGeometry(1, 16, 16, 1);
  private static DebugMaterial = new THREE.MeshBasicMaterial({
    color: 0x00aa00,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });

  private debugMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;

  constructor(private positionProbe: Interaction<ThreeJSGraphicsAdapter>) {
    super(positionProbe);
  }

  disable(): void {}

  enable(): void {}

  setRange(): void {
    this.updateDebugVisualisation();
  }

  setInFocus(): void {
    // no-op
  }

  setLineOfSight(): void {
    // no-op
  }

  setPriority(): void {
    // no-op
  }

  setPrompt(): void {
    // no-op
  }

  setDebug() {
    this.updateDebugVisualisation();
  }

  private clearDebugVisualisation() {
    if (this.debugMesh) {
      this.debugMesh.removeFromParent();
      this.debugMesh = null;
    }
  }

  private updateDebugVisualisation() {
    if (!this.positionProbe.props.debug) {
      this.clearDebugVisualisation();
    } else {
      if (this.positionProbe.isConnected && !this.debugMesh) {
        const mesh = new THREE.Mesh(
          ThreeJSInteraction.DebugGeometry,
          ThreeJSInteraction.DebugMaterial,
        );
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        this.debugMesh = mesh;
        this.positionProbe.getContainer().add(this.debugMesh);
      }

      if (this.debugMesh) {
        this.debugMesh.scale.set(
          this.positionProbe.props.range,
          this.positionProbe.props.range,
          this.positionProbe.props.range,
        );
      }
    }
  }

  dispose() {
    this.clearDebugVisualisation();
  }
}
