import RAPIER from "@dimforge/rapier3d-compat";
import { ModelLoader } from "@mml-io/model-loader";
import {
  clampFinite,
  computeWorldTransformFor as mathComputeWorldTransformFor,
  Quat,
  quaternionToEulerXYZ,
  Vec3,
} from "mml-game-math-system";
import { ElementSystem, initElementSystem } from "mml-game-systems-common";
import * as THREE from "three";

export type PhysicsConfig = {
  gravity?: number;
  enableCollisions?: boolean;
  maxSubsteps?: number;
  timeStep?: number;
  debug?: boolean;
};

export type RaycastResult = {
  hit: boolean;
  distance?: number;
  point?: { x: number; y: number; z: number };
  normal?: { x: number; y: number; z: number };
  element?: Element;
};

export type CollisionEvent = {
  type: "collision_start" | "collision_end" | "sensor_enter" | "sensor_exit";
  elementA: Element;
  elementB: Element;
  point?: { x: number; y: number; z: number };
  normal?: { x: number; y: number; z: number };
};

type PhysicsElementState = {
  rigidbody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  element: Element;
  lerpElement: Element;
};

class PhysicsSystem implements ElementSystem {
  private world: RAPIER.World | null = null;
  private elementToBody = new Map<Element, PhysicsElementState>();
  private bodyToElement = new Map<number, PhysicsElementState>();
  private colliderToElement = new Map<RAPIER.ColliderHandle, PhysicsElementState>();
  private config: Required<PhysicsConfig> = {
    gravity: 9.81,
    enableCollisions: true,
    maxSubsteps: 5,
    timeStep: 1 / 60,
    debug: false,
  };
  private lastNetworkTime = 0;
  private isRunning = false;
  private eventQueue: RAPIER.EventQueue | null = null;
  private collisionEventListeners = new Set<(event: CollisionEvent) => void>();
  private debugUpdateCallback:
    | ((buffers: { vertices: Float32Array; colors: Float32Array }) => void)
    | null = null;
  private modelLoader = new ModelLoader();
  private debugMeshElements = new Map<Element, HTMLElement>();

  private computeWorldTransformFor(element: Element | null) {
    return mathComputeWorldTransformFor(element, {
      getBodyForElement: (el: Element) => {
        const state = this.elementToBody.get(el);
        return state?.rigidbody || null;
      },
    });
  }

  /**
   * Extracts geometry from a GLB model and creates a trimesh collider
   * @private
   */
  private resolveAssetURL(url: string): string {
    // If the URL is already absolute (starts with http:// or https://), return as-is
    if (url.startsWith("http://") || url.startsWith("https://")) {
      console.log(
        `[Physics] Using absolute URL: ${url} ----------------------------------------------------`,
      );
      return url;
    }

    // If the URL is relative (starts with /), resolve it to an absolute URL
    if (url.startsWith("/")) {
      // Check if we have a params.__ASSET_SERVER_URL__ configured (injected by GameMMLDocumentManager)
      if (
        typeof window !== "undefined" &&
        (window as any).params &&
        (window as any).params.__ASSET_SERVER_URL__
      ) {
        const baseUrl = (window as any).params.__ASSET_SERVER_URL__;
        console.log(`[Physics] Using configured asset server URL from params: ${baseUrl}`);
        return baseUrl + url;
      }

      // Try to use window.location.origin if available and it's HTTP
      if (typeof window !== "undefined" && window.location && window.location.origin) {
        const origin = window.location.origin;
        console.log(`[Physics] window.location.origin = ${origin}`);
        // Only use it if it's an actual HTTP origin
        if (origin.startsWith("http://") || origin.startsWith("https://")) {
          console.log(`[Physics] Using window.location.origin: ${origin}`);
          return origin + url;
        }
      }

      // Fallback: try to construct from window.location parts
      if (typeof window !== "undefined" && window.location) {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = window.location.port;
        console.log(
          `[Physics] window.location: protocol=${protocol}, hostname=${hostname}, port=${port}`,
        );

        // Only construct if we have HTTP protocol
        if (protocol && (protocol === "http:" || protocol === "https:")) {
          const portPart = port ? `:${port}` : "";
          const resolved = `${protocol}//${hostname}${portPart}${url}`;
          console.log(`[Physics] Constructed URL: ${resolved}`);
          return resolved;
        }
      }

      // Last resort fallback: assume localhost:3000
      const fallbackUrl = `http://localhost:3000${url}`;
      console.warn(
        `[Physics] Could not resolve origin for relative URL: ${url}, using fallback: ${fallbackUrl}`,
      );
      return fallbackUrl;
    }

    // Return as-is for other types of URLs
    return url;
  }

  /**
   * Parse GLB file and extract geometry directly without loading textures.
   * This is necessary because GLTFLoader hangs in JSDOM when textures fail to load.
   */
  private parseGLBGeometry(
    buffer: ArrayBuffer,
  ): { vertices: Float32Array; indices: Uint32Array } | null {
    const dataView = new DataView(buffer);

    // Read GLB header
    const magic = dataView.getUint32(0, true);
    if (magic !== 0x46546c67) {
      // 'glTF' in little-endian
      console.error("[Physics] Not a valid GLB file");
      return null;
    }

    const version = dataView.getUint32(4, true);
    if (version !== 2) {
      console.error("[Physics] Unsupported GLB version:", version);
      return null;
    }

    // Read chunks
    let offset = 12;
    let jsonChunk: any = null;
    let binChunk: ArrayBuffer | null = null;

    while (offset < buffer.byteLength) {
      const chunkLength = dataView.getUint32(offset, true);
      const chunkType = dataView.getUint32(offset + 4, true);

      if (chunkType === 0x4e4f534a) {
        // 'JSON'
        const jsonBytes = new Uint8Array(buffer, offset + 8, chunkLength);
        const jsonString = new TextDecoder().decode(jsonBytes);
        jsonChunk = JSON.parse(jsonString);
      } else if (chunkType === 0x004e4942) {
        // 'BIN\0'
        binChunk = buffer.slice(offset + 8, offset + 8 + chunkLength);
      }

      offset += 8 + chunkLength;
    }

    if (!jsonChunk || !binChunk) {
      console.error("[Physics] Missing JSON or BIN chunk in GLB");
      return null;
    }

    const allVertices: number[] = [];
    const allIndices: number[] = [];
    let vertexOffset = 0;

    // Process all meshes
    const meshes = jsonChunk.meshes || [];
    const accessors = jsonChunk.accessors || [];
    const bufferViews = jsonChunk.bufferViews || [];
    const nodes = jsonChunk.nodes || [];

    // Build node transform matrices with proper scene graph traversal
    const scene = jsonChunk.scene || 0;
    const scenes = jsonChunk.scenes || [];
    const sceneNodes = scenes[scene]?.nodes || [];

    // Helper to multiply 4x4 matrices (column-major as in GLTF)
    const multiplyMatrices = (a: number[], b: number[]): number[] => {
      const result = new Array(16);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          result[i * 4 + j] =
            a[i * 4 + 0] * b[0 * 4 + j] +
            a[i * 4 + 1] * b[1 * 4 + j] +
            a[i * 4 + 2] * b[2 * 4 + j] +
            a[i * 4 + 3] * b[3 * 4 + j];
        }
      }
      return result;
    };

    // Convert quaternion to rotation matrix
    const quatToMatrix = (q: number[]): number[] => {
      const [x, y, z, w] = q;
      return [
        1 - 2 * (y * y + z * z),
        2 * (x * y - z * w),
        2 * (x * z + y * w),
        0,
        2 * (x * y + z * w),
        1 - 2 * (x * x + z * z),
        2 * (y * z - x * w),
        0,
        2 * (x * z - y * w),
        2 * (y * z + x * w),
        1 - 2 * (x * x + y * y),
        0,
        0,
        0,
        0,
        1,
      ];
    };

    // Build node transform matrix
    const getNodeMatrix = (
      nodeIndex: number,
      parentMatrix: number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    ): number[] => {
      const node = nodes[nodeIndex];
      if (!node) return parentMatrix;

      let localMatrix: number[];

      if (node.matrix) {
        localMatrix = node.matrix;
      } else {
        // Build from TRS
        const t = node.translation || [0, 0, 0];
        const r = node.rotation || [0, 0, 0, 1];
        const s = node.scale || [1, 1, 1];

        // Build TRS matrix: T * R * S
        const rotMatrix = quatToMatrix(r);
        const scaleMatrix = [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, 0, 0, 0, 1];
        const transMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1];

        // Multiply: transMatrix * rotMatrix * scaleMatrix
        const rotScale = multiplyMatrices(rotMatrix, scaleMatrix);
        localMatrix = multiplyMatrices(transMatrix, rotScale);
      }

      // Multiply with parent matrix
      return multiplyMatrices(parentMatrix, localMatrix);
    };

    // Traverse scene graph recursively
    const traverseNode = (
      nodeIndex: number,
      parentMatrix: number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    ) => {
      const node = nodes[nodeIndex];
      if (!node) return;

      const worldMatrix = getNodeMatrix(nodeIndex, parentMatrix);

      // Process mesh if present
      if (node.mesh !== undefined) {
        const mesh = meshes[node.mesh];
        if (mesh && mesh.primitives) {
          for (const primitive of mesh.primitives) {
            // Get position accessor
            const posAccessorIdx = primitive.attributes?.POSITION;
            if (posAccessorIdx === undefined) continue;

            const posAccessor = accessors[posAccessorIdx];
            const posBufferView = bufferViews[posAccessor.bufferView];

            const posOffset = (posBufferView.byteOffset || 0) + (posAccessor.byteOffset || 0);
            const byteStride =
              posBufferView.byteStride || (posAccessor.componentType === 5126 ? 12 : 0);
            const stride = byteStride > 0 ? byteStride / 4 : 3;

            const posData = new Float32Array(binChunk, posOffset, posAccessor.count * stride);

            // Transform and add vertices
            for (let i = 0; i < posAccessor.count; i++) {
              const baseIdx = i * stride;
              const x = posData[baseIdx];
              const y = posData[baseIdx + 1];
              const z = posData[baseIdx + 2];

              // Apply world matrix (column-major)
              const tx =
                x * worldMatrix[0] + y * worldMatrix[4] + z * worldMatrix[8] + worldMatrix[12];
              const ty =
                x * worldMatrix[1] + y * worldMatrix[5] + z * worldMatrix[9] + worldMatrix[13];
              const tz =
                x * worldMatrix[2] + y * worldMatrix[6] + z * worldMatrix[10] + worldMatrix[14];

              allVertices.push(tx, ty, tz);
            }

            // Get indices
            if (primitive.indices !== undefined) {
              const idxAccessor = accessors[primitive.indices];
              const idxBufferView = bufferViews[idxAccessor.bufferView];
              const idxOffset = (idxBufferView.byteOffset || 0) + (idxAccessor.byteOffset || 0);

              let idxData: Uint16Array | Uint32Array;
              if (idxAccessor.componentType === 5123) {
                // UNSIGNED_SHORT
                idxData = new Uint16Array(binChunk, idxOffset, idxAccessor.count);
              } else if (idxAccessor.componentType === 5125) {
                // UNSIGNED_INT
                idxData = new Uint32Array(binChunk, idxOffset, idxAccessor.count);
              } else {
                console.warn(
                  `[Physics] Unsupported index component type: ${idxAccessor.componentType}`,
                );
                continue;
              }

              for (let i = 0; i < idxData.length; i++) {
                allIndices.push(idxData[i] + vertexOffset);
              }
            } else {
              // Generate indices for non-indexed geometry
              for (let i = 0; i < posAccessor.count; i++) {
                allIndices.push(i + vertexOffset);
              }
            }

            vertexOffset += posAccessor.count;
          }
        }
      }

      // Traverse children
      if (node.children) {
        for (const childIdx of node.children) {
          traverseNode(childIdx, worldMatrix);
        }
      }
    };

    // Start traversal from scene root nodes
    for (const rootNodeIdx of sceneNodes) {
      traverseNode(rootNodeIdx);
    }

    if (allVertices.length === 0 || allIndices.length === 0) {
      console.warn("[Physics] No geometry found in GLB");
      return null;
    }

    console.log(
      `[Physics] Parsed GLB: ${allVertices.length / 3} vertices, ${allIndices.length / 3} triangles`,
    );

    return {
      vertices: new Float32Array(allVertices),
      indices: new Uint32Array(allIndices),
    };
  }

  private async extractGeometryFromModel(src: string): Promise<{
    vertices: Float32Array;
    indices: Uint32Array;
  } | null> {
    try {
      // Resolve relative URLs to absolute URLs for server-side loading
      const resolvedSrc = this.resolveAssetURL(src);
      console.log(`[Physics] Loading model for collision: ${src} (resolved to: ${resolvedSrc})`);

      // In Node.js/JSDOM environment, use our custom GLB parser to avoid texture loading hangs
      if (typeof window !== "undefined" && window.fetch) {
        try {
          const response = await window.fetch(resolvedSrc);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const fetchedBuffer = await response.arrayBuffer();

          // Create realm-local ArrayBuffer
          const sourceView = new Uint8Array(fetchedBuffer);
          const realmArrayBuffer = new ArrayBuffer(sourceView.byteLength);
          const destView = new Uint8Array(realmArrayBuffer);
          destView.set(sourceView);

          console.log(
            `[Physics] Parsing GLB geometry from ${realmArrayBuffer.byteLength} bytes...`,
          );

          // Use our custom GLB parser that doesn't load textures
          const geometry = this.parseGLBGeometry(realmArrayBuffer);
          if (geometry) {
            return geometry;
          }

          console.warn(`[Physics] Custom GLB parser failed, model may not have geometry`);
          return null;
        } catch (fetchError) {
          console.error(`[Physics] Failed to fetch/parse GLB:`, fetchError);
          return null;
        }
      }

      // Fallback for browser environment - use ModelLoader
      const modelResult = await this.modelLoader.load(resolvedSrc);

      if (!modelResult || !modelResult.group) {
        console.error(`[Physics] Model result is invalid`);
        return null;
      }

      const { group } = modelResult;
      const allVertices: number[] = [];
      const allIndices: number[] = [];
      let vertexOffset = 0;

      group.traverse((child: THREE.Object3D) => {
        const isMesh = child.type === "Mesh" || (child as any).isMesh === true;
        if (isMesh && (child as THREE.Mesh).geometry) {
          const geometry = (child as THREE.Mesh).geometry;
          if (!geometry.attributes.position) return;

          const positions = geometry.attributes.position.array;
          child.updateMatrixWorld(true);
          const matrix = child.matrixWorld;

          for (let i = 0; i < positions.length; i += 3) {
            const vertex = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
            vertex.applyMatrix4(matrix);
            allVertices.push(vertex.x, vertex.y, vertex.z);
          }

          const indices = geometry.index
            ? Array.from(geometry.index.array)
            : Array.from({ length: positions.length / 3 }, (_, i) => i);

          for (const index of indices) {
            allIndices.push(index + vertexOffset);
          }
          vertexOffset += positions.length / 3;
        }
      });

      if (allVertices.length === 0) return null;

      return {
        vertices: new Float32Array(allVertices),
        indices: new Uint32Array(allIndices),
      };
    } catch (error) {
      console.error(`[Physics] Failed to load model for collision: ${src}`, error);
      return null;
    }
  }

  private createDebugVisualization(
    element: Element,
    geometry: { vertices: Float32Array; indices: Uint32Array },
    worldPosition: { x: number; y: number; z: number },
  ): void {
    try {
      // Create a group to hold all debug lines
      const debugGroup = document.createElement("m-group");
      debugGroup.setAttribute("id", `physics-debug-${Date.now()}`);

      // Position debug group at element's world position
      debugGroup.setAttribute("x", worldPosition.x.toFixed(3));
      debugGroup.setAttribute("y", worldPosition.y.toFixed(3));
      debugGroup.setAttribute("z", worldPosition.z.toFixed(3));

      // Draw edges of triangles from the trimesh
      const triangleCount = geometry.indices.length / 3;
      console.log(`[Physics Debug] Creating visualization for ${triangleCount} triangles`);

      // Sample a subset of triangles to avoid overwhelming the scene
      const maxTrianglesToShow = 500;
      const stride = Math.max(1, Math.floor(triangleCount / maxTrianglesToShow));

      for (let i = 0; i < triangleCount; i += stride) {
        const idx0 = geometry.indices[i * 3] * 3;
        const idx1 = geometry.indices[i * 3 + 1] * 3;
        const idx2 = geometry.indices[i * 3 + 2] * 3;

        // Get triangle vertices (already scaled)
        const v0 = {
          x: geometry.vertices[idx0],
          y: geometry.vertices[idx0 + 1],
          z: geometry.vertices[idx0 + 2],
        };
        const v1 = {
          x: geometry.vertices[idx1],
          y: geometry.vertices[idx1 + 1],
          z: geometry.vertices[idx1 + 2],
        };
        const v2 = {
          x: geometry.vertices[idx2],
          y: geometry.vertices[idx2 + 1],
          z: geometry.vertices[idx2 + 2],
        };

        // Create lines for each edge of the triangle
        this.createDebugLine(debugGroup, v0, v1);
        this.createDebugLine(debugGroup, v1, v2);
        this.createDebugLine(debugGroup, v2, v0);
      }

      // Append the debug group as a sibling to the physics element
      if (element.parentElement) {
        element.parentElement.appendChild(debugGroup);
        this.debugMeshElements.set(element, debugGroup);
        console.log(
          `[Physics Debug] Created wireframe visualization (${Math.ceil(triangleCount / stride)} triangles shown) at (${worldPosition.x.toFixed(2)}, ${worldPosition.y.toFixed(2)}, ${worldPosition.z.toFixed(2)})`,
        );
      }
    } catch (error) {
      console.error(`[Physics Debug] Failed to create visualization:`, error);
    }
  }

  private createDebugLine(
    parent: HTMLElement,
    start: { x: number; y: number; z: number },
    end: { x: number; y: number; z: number },
  ): void {
    // Use m-cube as thin wireframe segments since m-line might not exist
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const midZ = (start.z + end.z) / 2;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (length < 0.001) return; // Skip zero-length lines

    const line = document.createElement("m-cube");
    line.setAttribute("x", midX.toFixed(3));
    line.setAttribute("y", midY.toFixed(3));
    line.setAttribute("z", midZ.toFixed(3));
    line.setAttribute("width", "0.05");
    line.setAttribute("height", "0.05");
    line.setAttribute("depth", length.toFixed(3));
    line.setAttribute("color", "#00ff00"); // Green for visibility
    line.setAttribute("opacity", "0.8");
    line.setAttribute("collide", "false");

    // Rotate to align with line direction
    if (Math.abs(dz) > 0.001 || Math.abs(dx) > 0.001) {
      const yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
      line.setAttribute("ry", yaw.toFixed(1));
    }
    if (Math.abs(dy) > 0.001) {
      const pitch = (Math.asin(dy / length) * 180) / Math.PI;
      line.setAttribute("rx", pitch.toFixed(1));
    }

    parent.appendChild(line);
  }

  async init(config: PhysicsConfig = {}) {
    // Prevent multiple initialization
    if (this.world) {
      console.warn("Physics system already initialized");
      return;
    }

    try {
      await RAPIER.init();

      // Merge config with defaults - check window.systemsConfig first if config is empty
      if (
        Object.keys(config).length === 0 &&
        typeof window !== "undefined" &&
        (window as any).systemsConfig
      ) {
        const savedConfig = (window as any).systemsConfig["physics"];
        if (savedConfig) {
          config = savedConfig;
        }
      }
      this.config = { ...this.config, ...config };
      console.log(`[Physics] Config applied:`, this.config);

      // Create physics world
      const gravity = new RAPIER.Vector3(0.0, -this.config.gravity, 0.0);
      this.world = new RAPIER.World(gravity);

      // Create event queue for collision detection
      this.eventQueue = new RAPIER.EventQueue(true);
    } catch (error) {
      console.error("Failed to initialize physics system:", error);
      throw error;
    }
  }

  updateConfig(config: Partial<PhysicsConfig>) {
    this.config = { ...this.config, ...config };

    if (this.world && config.gravity !== undefined) {
      const gravity = new RAPIER.Vector3(0.0, -config.gravity, 0.0);
      this.world.gravity = gravity;
    }
  }

  /**
   * Enable or disable physics debug rendering.
   */
  setDebugEnabled(enabled: boolean) {
    this.config.debug = enabled;
  }

  /**
   * Register a callback to receive Rapier debug render buffers every step.
   * Returns an unsubscribe function.
   */
  onDebugRenderUpdate(
    callback: (buffers: { vertices: Float32Array; colors: Float32Array }) => void,
  ) {
    this.debugUpdateCallback = callback;
    return () => {
      if (this.debugUpdateCallback === callback) {
        this.debugUpdateCallback = null;
      }
    };
  }

  /**
   * Get a snapshot of the current debug render buffers.
   */
  getDebugRenderBuffers(): {
    vertices: Float32Array;
    colors: Float32Array;
  } | null {
    if (!this.world) return null;
    const { vertices, colors } = this.world.debugRender();
    return { vertices, colors };
  }

  /**
   * @description Adds physics behavior to an MML element like m-cube, m-sphere, m-cylinder, or m-model
   * @example
   * const cube = document.querySelector('m-cube');
   * physics.addRigidbody(cube, {
   *     mass: 2.0,
   *     friction: 0.8,
   *     restitution: 0.3 // bounciness
   * });
   *
   * // For m-model with GLB collision geometry:
   * const model = document.querySelector('m-model');
   * await physics.addRigidbody(model, { kinematic: true });
   */
  async addRigidbody(
    element: Element,
    options: {
      mass?: number;
      kinematic?: boolean;
      sensor?: boolean;
      friction?: number;
      restitution?: number;
      gravity?: number;
    } = {},
  ) {
    if (!this.world) {
      console.error("Physics world not initialized");
      return;
    }

    // Check if element already has a rigidbody to prevent duplicates
    if (this.elementToBody.has(element)) {
      console.warn("[Physics] Element already has rigidbody, skipping duplicate add");
      return;
    }

    // Compute world transform (includes parent transforms)
    const worldTransform = this.computeWorldTransformFor(element);
    const {
      position: worldPosition,
      rotation: worldRotation,
      scale: worldScaleRaw,
    } = worldTransform;
    const worldScale = {
      x: Math.abs(worldScaleRaw.x || 1),
      y: Math.abs(worldScaleRaw.y || 1),
      z: Math.abs(worldScaleRaw.z || 1),
    };

    // Create rigidbody
    const rigidBodyDesc = options.kinematic
      ? RAPIER.RigidBodyDesc.kinematicPositionBased()
      : RAPIER.RigidBodyDesc.dynamic();

    rigidBodyDesc.setTranslation(worldPosition.x, worldPosition.y, worldPosition.z);
    rigidBodyDesc.setRotation({
      x: worldRotation.x,
      y: worldRotation.y,
      z: worldRotation.z,
      w: worldRotation.w,
    });

    if (options.mass !== undefined) {
      rigidBodyDesc.setAdditionalMass(options.mass);
    }

    // Apply custom gravity if specified
    if (options.gravity !== undefined) {
      const gravityScale = options.gravity / this.config.gravity;
      rigidBodyDesc.setGravityScale(gravityScale);
    }

    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    // Create collider based on element type using worldScale that already includes size for leaf (via math)
    let colliderDesc: RAPIER.ColliderDesc;
    const tagName = element.tagName.toLowerCase();

    switch (tagName) {
      case "m-cube": {
        colliderDesc = RAPIER.ColliderDesc.cuboid(
          worldScale.x / 2,
          worldScale.y / 2,
          worldScale.z / 2,
        );
        break;
      }

      case "m-sphere": {
        // Approximate with uniform radius using max component
        const radius = Math.max(worldScale.x, worldScale.y, worldScale.z) / 2;
        colliderDesc = RAPIER.ColliderDesc.ball(radius);
        break;
      }

      case "m-cylinder": {
        const halfHeight = worldScale.y / 2;
        const radius = Math.max(worldScale.x, worldScale.z) / 2;
        colliderDesc = RAPIER.ColliderDesc.cylinder(halfHeight, radius);
        break;
      }

      case "m-capsule": {
        // in rapier they use  capsule(halfHeight, radius) where halfHeight is half of the
        // cylindrical middle section. m-capsule total height = height + radius * 2
        // (height is middle section, caps add radius on each end)
        // worldScale.y already includes the full height from the element
        const capsuleRadius = Math.max(worldScale.x, worldScale.z) / 2;
        // the middle section height in world scale (halved for rapier
        const capsuleHalfHeight = Math.max(0, (worldScale.y - capsuleRadius * 2) / 2);
        colliderDesc = RAPIER.ColliderDesc.capsule(capsuleHalfHeight, capsuleRadius);
        break;
      }

      case "m-plane": {
        // Use thin box per worldScale; Y is thickness
        const halfX = worldScale.x / 2;
        const halfY = worldScale.y / 2;
        const halfZ = worldScale.z / 2;
        colliderDesc = RAPIER.ColliderDesc.cuboid(halfX, Math.max(halfY, 0.005), halfZ);
        break;
      }

      case "m-model": {
        // Extract geometry from GLB and create trimesh collider
        const src = element.getAttribute("src");
        if (!src) {
          console.warn("[Physics] m-model has no src attribute, using default box collider");
          colliderDesc = RAPIER.ColliderDesc.cuboid(
            0.5 * worldScale.x,
            0.5 * worldScale.y,
            0.5 * worldScale.z,
          );
        } else {
          const geometry = await this.extractGeometryFromModel(src);
          if (geometry) {
            // Scale vertices by worldScale to match element's visual scale
            const scaledVertices = new Float32Array(geometry.vertices.length);
            for (let i = 0; i < geometry.vertices.length; i += 3) {
              scaledVertices[i] = geometry.vertices[i] * worldScale.x;
              scaledVertices[i + 1] = geometry.vertices[i + 1] * worldScale.y;
              scaledVertices[i + 2] = geometry.vertices[i + 2] * worldScale.z;
            }

            // Create scaled geometry object for debug visualization
            const scaledGeometry = {
              vertices: scaledVertices,
              indices: geometry.indices,
            };

            // Create trimesh collider from scaled geometry
            colliderDesc = RAPIER.ColliderDesc.trimesh(scaledVertices, geometry.indices);
            console.log(
              `[Physics] Created trimesh collider for m-model: ${src} (scaled by ${worldScale.x}, ${worldScale.y}, ${worldScale.z})`,
            );

            // Create debug visualization if debug mode is enabled
            // Check both this.config and window.systemsConfig (in case init hasn't completed yet)
            const debugEnabled =
              this.config.debug ||
              (typeof window !== "undefined" &&
                (window as any).systemsConfig?.physics?.debug === true);
            if (debugEnabled) {
              this.createDebugVisualization(element, scaledGeometry, worldPosition);
            }
          } else {
            console.warn(
              `[Physics] Failed to extract geometry from ${src}, using default box collider`,
            );
            colliderDesc = RAPIER.ColliderDesc.cuboid(
              0.5 * worldScale.x,
              0.5 * worldScale.y,
              0.5 * worldScale.z,
            );
          }
        }
        break;
      }

      default:
        colliderDesc = RAPIER.ColliderDesc.cuboid(
          0.5 * worldScale.x,
          0.5 * worldScale.y,
          0.5 * worldScale.z,
        );
    }

    // Set material properties
    if (options.friction !== undefined) {
      colliderDesc.setFriction(options.friction);
    }
    if (options.restitution !== undefined) {
      colliderDesc.setRestitution(options.restitution);
    }
    if (options.sensor) {
      colliderDesc.setSensor(true);
    }
    // Enable collision start/end events if collisions are enabled globally
    if (this.config.enableCollisions) {
      colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    }

    const collider = this.world.createCollider(colliderDesc, rigidBody);

    const lerpElement = document.createElement("m-attr-lerp");
    lerpElement.setAttribute("attr", "x,y,z,rx,ry,rz");
    lerpElement.setAttribute("duration", "100");
    element.appendChild(lerpElement);

    const state: PhysicsElementState = {
      rigidbody: rigidBody,
      collider,
      element,
      lerpElement,
    };

    // Store mappings
    this.elementToBody.set(element, state);
    this.bodyToElement.set(rigidBody.handle, state);
    this.colliderToElement.set(collider.handle, state);
  }

  /**
   * @description Removes physics behavior from an MML element
   * @example
   * const cube = document.querySelector('m-cube[rigidbody]');
   * physics.removeRigidbody(cube); // Element becomes static again
   */
  removeRigidbody(element: Element) {
    if (!this.world) return;

    const physicsState = this.elementToBody.get(element);
    if (physicsState) {
      if (physicsState.collider !== undefined) {
        this.colliderToElement.delete(physicsState.collider.handle);
        this.world?.removeCollider(physicsState.collider, true);
      }
      this.bodyToElement.delete(physicsState.rigidbody.handle);
      this.elementToBody.delete(element);
      this.world.removeRigidBody(physicsState.rigidbody);
    }
  }

  /**
   * @description Casts a ray through the physics world to detect collisions
   * @example
   * const result = physics.raycast(
   *     { x: 0, y: 10, z: 0 }, // from
   *     { x: 0, y: -1, z: 0 }, // direction (normalized)
   *     20 // max distance
   * );
   * if (result.hit) {
   *     console.log('Hit element:', result.element);
   *     console.log('Hit point:', result.point);
   * }
   */
  raycast(
    from: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    maxDistance: number = 100,
  ): RaycastResult {
    if (!this.world) {
      return { hit: false };
    }

    const ray = new RAPIER.Ray(
      new RAPIER.Vector3(from.x, from.y, from.z),
      new RAPIER.Vector3(direction.x, direction.y, direction.z),
    );

    const hit = this.world.castRay(ray, maxDistance, true);

    if (hit) {
      const hitPoint = ray.pointAt(hit.timeOfImpact);
      const physicsState = this.bodyToElement.get(hit.collider.parent()?.handle || -1);

      return {
        hit: true,
        distance: hit.timeOfImpact,
        point: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
        element: physicsState?.element,
      };
    }

    return { hit: false };
  }

  /**
   * @description Applies a continuous force to an element with physics
   * @example
   * const cube = document.querySelector('m-cube[rigidbody]');
   * physics.applyForce(cube, { x: 10, y: 0, z: 0 }); // Push right
   */
  applyForce(element: Element, force: { x: number; y: number; z: number }) {
    const physicsState = this.elementToBody.get(element);
    if (physicsState) {
      const forceVector = new RAPIER.Vector3(force.x, force.y, force.z);
      physicsState.rigidbody.addForce(forceVector, true);
    }
  }

  /**
   * @description Applies an instantaneous impulse to an element with physics
   * @example
   * const cube = document.querySelector('m-cube[rigidbody]');
   * physics.applyImpulse(cube, { x: 5, y: 10, z: 0 }); // Launch up and right
   */
  applyImpulse(element: Element, impulse: { x: number; y: number; z: number }) {
    const physicsState = this.elementToBody.get(element);
    if (physicsState) {
      const impulseVector = new RAPIER.Vector3(impulse.x, impulse.y, impulse.z);
      physicsState.rigidbody.applyImpulse(impulseVector, true);
    }
  }

  /**
   * @description Sets the velocity of an element with physics
   * @example
   * const cube = document.querySelector('m-cube[rigidbody]');
   * physics.setVelocity(cube, { x: 5, y: 0, z: 0 }); // Move right at 5 units/sec
   */
  setVelocity(element: Element, velocity: { x: number; y: number; z: number }) {
    const physicsState = this.elementToBody.get(element);
    if (physicsState) {
      const velocityVector = new RAPIER.Vector3(velocity.x, velocity.y, velocity.z);
      physicsState.rigidbody.setLinvel(velocityVector, true);
    }
  }

  /**
   * @description Gets the current velocity of an element with physics
   * @example
   * const cube = document.querySelector('m-cube[rigidbody]');
   * const velocity = physics.getVelocity(cube);
   * if (velocity) {
   *     console.log('Velocity:', velocity.x, velocity.y, velocity.z);
   * }
   */
  getVelocity(element: Element): { x: number; y: number; z: number } | null {
    const physicsState = this.elementToBody.get(element);
    if (physicsState) {
      const velocity = physicsState.rigidbody.linvel();
      return { x: velocity.x, y: velocity.y, z: velocity.z };
    }
    return null;
  }

  /**
   * @description Registers a callback for collision events between physics objects
   * @example
   * const removeListener = physics.onCollision((event) => {
   *     console.log('Collision between:', event.elementA, event.elementB);
   *     if (event.type === 'collision_start') {
   *         console.log('Objects started colliding');
   *     }
   * });
   * // Later: removeListener() to stop listening
   */
  onCollision(callback: (event: CollisionEvent) => void) {
    this.collisionEventListeners.add(callback);
    return () => this.collisionEventListeners.delete(callback);
  }

  /**
   * Move a kinematic rigidbody to a world-space translation (and optional yaw rotation).
   * Returns true if a kinematic body was found and scheduled for movement.
   */
  moveKinematic(
    element: Element,
    worldPosition: { x: number; y: number; z: number },
    options?: { yawRadians?: number },
  ): boolean {
    const physicsState = this.elementToBody.get(element);
    if (!physicsState) return false;

    const rb = physicsState.rigidbody;
    // Only drive kinematic bodies directly; dynamic bodies should be driven via forces/velocities
    if (!(rb as any).isKinematic || !(rb as any).isKinematic()) {
      return false;
    }

    // Schedule next kinematic transform in world-space
    rb.setNextKinematicTranslation(
      new (RAPIER as any).Vector3(worldPosition.x, worldPosition.y, worldPosition.z),
    );

    if (options && typeof options.yawRadians === "number") {
      const half = options.yawRadians / 2;
      const sinHalf = Math.sin(half);
      const cosHalf = Math.cos(half);
      rb.setNextKinematicRotation({ x: 0, y: sinHalf, z: 0, w: cosHalf });
    }

    return true;
  }

  private processCollisionEvents() {
    if (!this.eventQueue || !this.world) return;

    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      const physicsStateA = this.colliderToElement.get(handle1);
      const physicsStateB = this.colliderToElement.get(handle2);

      if (physicsStateA && physicsStateB) {
        const event: CollisionEvent = {
          type: started ? "collision_start" : "collision_end",
          elementA: physicsStateA.element,
          elementB: physicsStateB.element,
        };

        this.collisionEventListeners.forEach((callback) => callback(event));
      }
    });
  }

  // Update physics simulation
  private stepCount = 0;
  step(deltaTime?: number) {
    if (!this.world || !this.isRunning) return;

    this.stepCount++;
    if (this.stepCount % 600 === 0) {
      // Log every 600 steps (~10 seconds)
      console.log(`[Physics] Step ${this.stepCount}, bodies: ${this.elementToBody.size}`);
    }

    const dt = deltaTime || this.config.timeStep;

    // Safety checks for deltaTime
    if (dt <= 0 || dt > 1 || !isFinite(dt)) {
      console.warn("Invalid deltaTime for physics step:", dt);
      return;
    }

    try {
      // Step the physics world with error recovery
      try {
        this.world.step(this.eventQueue || undefined);
      } catch (stepError) {
        console.error("Physics world step failed:", stepError);
        // Try to recover by stopping the system
        this.stop();
        return;
      }

      // Process collision events
      if (this.config.enableCollisions) {
        this.processCollisionEvents();
      }

      const tl = document.timeline;
      const ct = tl.currentTime;
      const currentTimeMs: number | null =
        ct == null ? null : typeof ct === "number" ? ct : ct.to("ms").value;
      if (currentTimeMs != null && currentTimeMs > this.lastNetworkTime + 100) {
        this.lastNetworkTime = currentTimeMs;
        this.updateElementPositions();
      }

      // Emit debug buffers to any registered consumer
      if (this.config.debug) {
        try {
          const { vertices, colors } = this.world.debugRender();
          window.parent.postMessage(
            {
              source: "ai-game-creator",
              type: "rapier-debug-buffers",
              vertices,
              colors,
            },
            "*",
          );
        } catch (e) {
          console.warn("Physics debug render failed:", e);
        }
      }
    } catch (error) {
      console.error("Physics step error:", error);
      // Try to recover by stopping the system
      this.stop();
    }
  }

  private updateElementPositions() {
    if (!this.world) return;

    // Create array to track invalid bodies for cleanup
    const invalidBodies: Element[] = [];

    this.elementToBody.forEach((physicsState, element) => {
      try {
        // Check if rigid body is still valid
        if (!physicsState.rigidbody.isValid()) {
          invalidBodies.push(element);
          return;
        }

        const translation = physicsState.rigidbody.translation();
        const rotation = physicsState.rigidbody.rotation();

        // Validate translation values
        if (!isFinite(translation.x) || !isFinite(translation.y) || !isFinite(translation.z)) {
          console.warn("Invalid translation values for element:", element);
          return;
        }

        // Compute local transform relative to parent's world transform
        const parentWorld = this.computeWorldTransformFor(element.parentElement);

        const worldPos = new Vec3(translation.x, translation.y, translation.z);
        const worldRot = new Quat(rotation.x, rotation.y, rotation.z, rotation.w).normalize();

        const invParentRot = parentWorld.rotation.conjugate();
        const localPosPreScale = invParentRot.rotateVector(worldPos.sub(parentWorld.position));
        const localPos = localPosPreScale.div(parentWorld.scale);
        const localRot = invParentRot.multiply(worldRot).normalize();

        // Validate translation values
        if (!isFinite(localPos.x) || !isFinite(localPos.y) || !isFinite(localPos.z)) {
          console.warn("Invalid local translation values for element:", element);
          return;
        }

        // Update element attributes (local space)
        element.setAttribute("x", clampFinite(localPos.x, 0).toFixed(3));
        element.setAttribute("y", clampFinite(localPos.y, 0).toFixed(3));
        element.setAttribute("z", clampFinite(localPos.z, 0).toFixed(3));

        // Update debug visualization position to match element
        const debugGroup = this.debugMeshElements.get(element);
        if (debugGroup) {
          debugGroup.setAttribute("x", clampFinite(localPos.x, 0).toFixed(3));
          debugGroup.setAttribute("y", clampFinite(localPos.y, 0).toFixed(3));
          debugGroup.setAttribute("z", clampFinite(localPos.z, 0).toFixed(3));
        }

        // Update rotation attributes only for non-kinematic bodies to avoid stomping
        // externally-driven visual rotation (e.g., navigation facing logic)
        const isKinematic = (physicsState.rigidbody as any).isKinematic
          ? (physicsState.rigidbody as any).isKinematic()
          : false;
        if (!isKinematic) {
          // Convert quaternion to Euler angles (degrees)
          const euler = quaternionToEulerXYZ(localRot);

          // Validate rotation values
          if (!isFinite(euler.x) || !isFinite(euler.y) || !isFinite(euler.z)) {
            console.warn("Invalid local rotation values for element:", element);
            return;
          }

          element.setAttribute("rx", ((euler.x * 180) / Math.PI).toFixed(3));
          element.setAttribute("ry", ((euler.y * 180) / Math.PI).toFixed(3));
          element.setAttribute("rz", ((euler.z * 180) / Math.PI).toFixed(3));
        }
      } catch (error) {
        console.warn("Error updating element position:", element, error);
        invalidBodies.push(element);
      }
    });

    // Clean up invalid bodies
    invalidBodies.forEach((element) => {
      console.warn("Removing invalid rigid body for element:", element);
      const physicsState = this.elementToBody.get(element);
      if (physicsState) {
        this.bodyToElement.delete(physicsState.rigidbody.handle);
      }
      this.elementToBody.delete(element);
    });
  }

  /**
   * Remove any physics bodies associated with a DOM element and its descendants.
   * Intended to be called when nodes are removed from the DOM.
   */
  onElementRemoved(element: Element) {
    try {
      // Build a list including the element and all its descendant elements
      const elementsToCheck: Element[] = [element];
      try {
        elementsToCheck.push(...(Array.from(element.querySelectorAll("*")) as Element[]));
      } catch {
        // Ignore selector errors; proceed with just the element
      }

      for (const el of elementsToCheck) {
        const physicsState = this.elementToBody.get(el);
        if (!physicsState) {
          continue;
        }

        // Remove mappings first
        this.elementToBody.delete(el);
        this.bodyToElement.delete(physicsState.rigidbody.handle);
        if (physicsState.collider !== undefined) {
          this.colliderToElement.delete(physicsState.collider.handle);
          this.world?.removeCollider(physicsState.collider, true);
        }

        // Remove from the world if still valid
        if (this.world && physicsState.rigidbody.isValid()) {
          try {
            this.world.removeRigidBody(physicsState.rigidbody);
          } catch (e) {
            console.warn("Failed to remove rigid body for element:", el, e);
          }
        }
      }
    } catch (error) {
      console.warn("Error handling element removal in physics system:", error);
    }
  }

  start() {
    this.isRunning = true;
  }

  stop() {
    this.isRunning = false;

    // Clear all physics bodies to prevent corruption
    this.clearAllBodies();
  }

  private clearAllBodies() {
    try {
      // Clear all mappings
      this.elementToBody.clear();
      this.bodyToElement.clear();
      this.colliderToElement.clear();

      // If world exists, remove all bodies
      if (this.world) {
        // Note: Bodies are automatically cleaned up when world is disposed
        console.log("Cleared all physics bodies");
      }
    } catch (error) {
      console.error("Error clearing physics bodies:", error);
    }
  }

  dispose() {
    this.stop();

    if (this.world) {
      this.world.free();
      this.world = null;
    }

    this.elementToBody.clear();
    this.bodyToElement.clear();
    this.colliderToElement.clear();
    this.collisionEventListeners.clear();
  }

  // Generic interface method for SystemsManager compatibility
  processElement(element: Element, attributes: Array<{ attributeName: string; value: any }>) {
    if (this.elementToBody.has(element)) {
      return;
    }

    // Find the main rigidbody attribute
    const rigidbodyAttr = attributes.find((attr) => attr.attributeName === "rigidbody");
    if (!rigidbodyAttr || !rigidbodyAttr.value) return;

    // Build options from all attributes
    const options: any = {};
    for (const { attributeName, value } of attributes) {
      if (attributeName !== "rigidbody") {
        options[attributeName] = value;
      }
    }

    // Add rigidbody to physics system (async, but don't await to avoid blocking)
    this.addRigidbody(element, options).catch((err) => {
      console.error("[Physics] Failed to add rigidbody:", err);
    });
  }
}

const physicsSystem = new PhysicsSystem();
console.log("Physics system created", physicsSystem);

initElementSystem("physics", physicsSystem, [
  "rigidbody",
  "mass",
  "gravity",
  "kinematic",
  "sensor",
  "friction",
  "restitution",
]);

export default physicsSystem;
