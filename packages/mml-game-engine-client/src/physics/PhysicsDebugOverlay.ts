import * as THREE from "three";

export class PhysicsDebugOverlay {
  private scene: THREE.Scene;
  private lineSegments: THREE.LineSegments | null = null;
  private positions: THREE.BufferAttribute | null = null;
  private colors: THREE.BufferAttribute | null = null;
  private material: THREE.LineBasicMaterial | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createLineSegments(0);
  }

  setVisible(visible: boolean) {
    if (this.lineSegments) {
      this.lineSegments.visible = visible;
    }
  }

  dispose() {
    if (this.lineSegments) {
      this.scene.remove(this.lineSegments);
      this.lineSegments.geometry.dispose();
      this.material?.dispose();
      this.lineSegments = null;
      this.material = null;
      this.positions = null;
      this.colors = null;
    }
  }

  updateBuffers(vertices: Float32Array, colors: Float32Array) {
    const vertexCount = Math.floor(vertices.length / 3);

    // Ensure geometry exists with enough capacity
    if (!this.lineSegments || !this.positions || this.positions.count !== vertexCount) {
      this.createLineSegments(vertexCount);
    }

    if (!this.positions || !this.colors) return;

    // Copy positions directly
    this.positions.array.set(vertices);
    this.positions.needsUpdate = true;

    // Rapier provides RGBA per-vertex; Three expects RGB
    const rgb = new Float32Array(vertexCount * 3);
    for (let i = 0, j = 0; i < colors.length; i += 4, j += 3) {
      rgb[j + 0] = colors[i + 0];
      rgb[j + 1] = colors[i + 1];
      rgb[j + 2] = colors[i + 2];
      // alpha ignored
    }
    this.colors.array.set(rgb);
    this.colors.needsUpdate = true;

    if (this.lineSegments) {
      this.lineSegments.visible = true;
    }
  }

  private createLineSegments(vertexCount: number) {
    if (this.lineSegments) {
      this.scene.remove(this.lineSegments);
      this.lineSegments.geometry.dispose();
      this.material?.dispose();
      this.lineSegments = null;
      this.material = null;
    }

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(Math.max(1, vertexCount) * 3);
    const colors = new Float32Array(Math.max(1, vertexCount) * 3);

    this.positions = new THREE.BufferAttribute(positions, 3);
    this.colors = new THREE.BufferAttribute(colors, 3);

    geometry.setAttribute("position", this.positions);
    geometry.setAttribute("color", this.colors);

    // Do not cull lines and render on top of scene by disabling depthTest softly
    this.material = new THREE.LineBasicMaterial({
      vertexColors: true,
      depthTest: true,
      transparent: false,
    });

    this.lineSegments = new THREE.LineSegments(geometry, this.material);
    this.lineSegments.frustumCulled = false;
    this.lineSegments.renderOrder = 1;
    this.lineSegments.visible = false;

    this.scene.add(this.lineSegments);
  }
}
