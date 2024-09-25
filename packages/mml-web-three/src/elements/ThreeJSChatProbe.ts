import { ChatProbe } from "mml-web";
import { ChatProbeGraphics } from "mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export class ThreeJSChatProbe extends ChatProbeGraphics<ThreeJSGraphicsAdapter> {
  private static DebugGeometry = new THREE.SphereGeometry(1, 16, 16, 1);
  private static DebugMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });

  private debugMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;

  constructor(private chatProbe: ChatProbe<ThreeJSGraphicsAdapter>) {
    super(chatProbe);
  }

  disable(): void {}

  enable(): void {}

  setRange(): void {
    this.updateDebugVisualisation();
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
    if (!this.chatProbe.props.debug) {
      this.clearDebugVisualisation();
    } else {
      if (this.chatProbe.isConnected && !this.debugMesh) {
        const mesh = new THREE.Mesh(ThreeJSChatProbe.DebugGeometry, ThreeJSChatProbe.DebugMaterial);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        this.debugMesh = mesh;
        this.chatProbe.getContainer().add(this.debugMesh);
      }

      if (this.debugMesh) {
        this.debugMesh.scale.set(
          this.chatProbe.props.range,
          this.chatProbe.props.range,
          this.chatProbe.props.range,
        );
      }
    }
  }

  dispose() {
    this.clearDebugVisualisation();
  }
}
