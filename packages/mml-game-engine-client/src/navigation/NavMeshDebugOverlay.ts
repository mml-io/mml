import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

export class NavMeshDebugOverlay {
  private scene: THREE.Scene;
  // Thin base lines (navmesh wireframe, agent/waypoints)
  private baseLineSegments: THREE.LineSegments | null = null;
  private basePositions: THREE.BufferAttribute | null = null;
  private baseColors: THREE.BufferAttribute | null = null;
  private baseMaterial: THREE.LineBasicMaterial | null = null;
  private baseVertexCount: number = 0;

  // Thick obstacle lines
  private obstacleSegments: LineSegments2 | null = null;
  private obstacleMaterial: LineMaterial | null = null;
  private obstacleVertexCount: number = 0;
  private mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial | THREE.MeshBasicMaterial> | null = null;
  private triVertexCount: number = 0;
  private handleResize = () => {
    if (this.obstacleMaterial) {
      this.obstacleMaterial.resolution.set(window.innerWidth, window.innerHeight);
    }
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createBaseSegments(0);
    this.createObstacleSegments(0);
    window.addEventListener("resize", this.handleResize);
  }

  setVisible(visible: boolean) {
    if (this.baseLineSegments) this.baseLineSegments.visible = visible;
    if (this.obstacleSegments) this.obstacleSegments.visible = visible;
    if (this.mesh) this.mesh.visible = visible;
  }

  dispose() {
    if (this.baseLineSegments) {
      this.scene.remove(this.baseLineSegments);
      this.baseLineSegments.geometry.dispose();
      this.baseMaterial?.dispose();
      this.baseLineSegments = null;
      this.baseMaterial = null;
      this.basePositions = null;
      this.baseColors = null;
    }
    if (this.obstacleSegments) {
      this.scene.remove(this.obstacleSegments);
      (this.obstacleSegments.geometry as LineSegmentsGeometry).dispose();
      this.obstacleMaterial?.dispose();
      this.obstacleSegments = null;
      this.obstacleMaterial = null;
    }
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as any)?.dispose?.();
      this.mesh = null;
    }
    window.removeEventListener("resize", this.handleResize);
  }

  updateBuffers(
    vertices: Float32Array,
    colors: Float32Array,
    triVertices?: Float32Array,
    triColors?: Float32Array,
    obstacleVertices?: Float32Array,
    obstacleColors?: Float32Array,
  ) {
    // Base thin lines
    const baseCount = Math.floor(vertices.length / 3);
    if (!this.baseLineSegments || this.baseVertexCount !== baseCount) {
      this.createBaseSegments(baseCount);
    }
    if (this.baseLineSegments && this.basePositions && this.baseColors) {
      // positions
      this.basePositions.array.set(vertices);
      this.basePositions.needsUpdate = true;
      // colors: RGBA -> RGB
      const rgb = new Float32Array(baseCount * 3);
      for (let i = 0, j = 0; i < colors.length; i += 4, j += 3) {
        rgb[j + 0] = colors[i + 0];
        rgb[j + 1] = colors[i + 1];
        rgb[j + 2] = colors[i + 2];
      }
      this.baseColors.array.set(rgb);
      this.baseColors.needsUpdate = true;
      this.baseLineSegments.visible = true;
    }

    // Thick obstacle lines
    const obCount = obstacleVertices ? Math.floor(obstacleVertices.length / 3) : 0;
    if (!this.obstacleSegments || this.obstacleVertexCount !== obCount) {
      this.createObstacleSegments(obCount);
    }
    if (this.obstacleSegments && this.obstacleMaterial) {
      const geom = this.obstacleSegments.geometry as LineSegmentsGeometry;
      if (obCount > 0 && obstacleVertices && obstacleColors) {
        // Convert RGBA to RGB per-vertex
        const obRgb = new Float32Array(obCount * 3);
        for (let i = 0, j = 0; i < obstacleColors.length; i += 4, j += 3) {
          obRgb[j + 0] = obstacleColors[i + 0];
          obRgb[j + 1] = obstacleColors[i + 1];
          obRgb[j + 2] = obstacleColors[i + 2];
        }
        geom.setPositions(obstacleVertices);
        geom.setColors(obRgb);
        geom.attributes.instanceStart.needsUpdate = true;
        geom.attributes.instanceEnd.needsUpdate = true;
        if (geom.getAttribute("instanceColorStart")) (geom.getAttribute("instanceColorStart") as THREE.BufferAttribute).needsUpdate = true;
        if (geom.getAttribute("instanceColorEnd")) (geom.getAttribute("instanceColorEnd") as THREE.BufferAttribute).needsUpdate = true;
        this.obstacleSegments.visible = true;
      } else {
        // Hide if none
        this.obstacleSegments.visible = false;
      }
    }

    // Triangles for filled navmesh (optional)
    if (triVertices && triVertices.length > 0 && triColors && triColors.length > 0) {
      const triCount = Math.floor(triVertices.length / 3);
      if (!this.mesh || this.triVertexCount !== triCount) {
        if (this.mesh) {
          this.scene.remove(this.mesh);
          this.mesh.geometry.dispose();
          (this.mesh.material as any)?.dispose?.();
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(triVertices.length), 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array((triVertices.length / 3) * 3), 3));
        const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, depthWrite: false });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 0;
        this.scene.add(this.mesh);
        this.triVertexCount = triCount;
      }
      if (this.mesh) {
        const g = this.mesh.geometry as THREE.BufferGeometry;
        (g.getAttribute("position") as THREE.BufferAttribute).array.set(triVertices);
        (g.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
        // triColors are RGBA, convert to RGB
        const triRGB = new Float32Array((triVertices.length / 3) * 3);
        for (let i = 0, j = 0; i < triColors.length; i += 4, j += 3) {
          triRGB[j + 0] = triColors[i + 0];
          triRGB[j + 1] = triColors[i + 1];
          triRGB[j + 2] = triColors[i + 2];
        }
        (g.getAttribute("color") as THREE.BufferAttribute).array.set(triRGB);
        (g.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
        this.mesh.visible = true;
      }
    } else if (this.mesh) {
      this.mesh.visible = false;
    }
  }

  private createBaseSegments(vertexCount: number) {
    if (this.baseLineSegments) {
      this.scene.remove(this.baseLineSegments);
      this.baseLineSegments.geometry.dispose();
      this.baseMaterial?.dispose();
      this.baseLineSegments = null;
      this.baseMaterial = null;
    }
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(Math.max(1, vertexCount) * 3);
    const colors = new Float32Array(Math.max(1, vertexCount) * 3);
    this.basePositions = new THREE.BufferAttribute(positions, 3);
    this.baseColors = new THREE.BufferAttribute(colors, 3);
    geometry.setAttribute("position", this.basePositions);
    geometry.setAttribute("color", this.baseColors);
    this.baseMaterial = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: true, transparent: false });
    this.baseLineSegments = new THREE.LineSegments(geometry, this.baseMaterial);
    this.baseLineSegments.frustumCulled = false;
    this.baseLineSegments.renderOrder = 1;
    this.baseLineSegments.visible = false;
    this.baseVertexCount = vertexCount;
    this.scene.add(this.baseLineSegments);
  }

  private createObstacleSegments(vertexCount: number) {
    if (this.obstacleSegments) {
      this.scene.remove(this.obstacleSegments);
      (this.obstacleSegments.geometry as LineSegmentsGeometry).dispose();
      this.obstacleMaterial?.dispose();
      this.obstacleSegments = null;
      this.obstacleMaterial = null;
    }
    const geometry = new LineSegmentsGeometry();
    this.obstacleMaterial = new LineMaterial({
      vertexColors: true,
      linewidth: 3,
      worldUnits: false,
      depthTest: true,
      transparent: false,
    });
    this.obstacleMaterial.resolution.set(window.innerWidth, window.innerHeight);
    this.obstacleSegments = new LineSegments2(geometry, this.obstacleMaterial);
    this.obstacleSegments.frustumCulled = false;
    this.obstacleSegments.renderOrder = 2;
    this.obstacleSegments.visible = false;
    this.obstacleVertexCount = vertexCount;
    this.scene.add(this.obstacleSegments);
  }
}


