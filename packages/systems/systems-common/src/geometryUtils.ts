import { ModelLoader, ModelLoadResult } from "@mml-io/model-loader";

/**
 * Geometry extraction result containing vertices and indices for mesh creation
 */
export interface GeometryResult {
  vertices: Float32Array;
  indices: Uint32Array;
}

/**
 * Options for extracting geometry from a model
 */
export interface ExtractGeometryOptions {
  /** Optional log prefix for console messages (e.g., "[Physics]", "[Navigation]") */
  logPrefix?: string;
  /** Optional ModelLoader instance for fallback loading */
  modelLoader?: ModelLoader;
}

/**
 * Resolves relative asset URLs to absolute URLs for server-side loading.
 * Handles various environments including JSDOM and browser contexts.
 *
 * @param url - The URL to resolve (can be relative or absolute)
 * @param logPrefix - Optional prefix for log messages (default: "[GeometryUtils]")
 * @returns The resolved absolute URL
 */
export function resolveAssetURL(url: string, logPrefix: string = "[GeometryUtils]"): string {
  // If the URL is already absolute (starts with http:// or https://), return as-is
  if (url.startsWith("http://") || url.startsWith("https://")) {
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
      console.log(`${logPrefix} Using configured asset server URL from params: ${baseUrl}`);
      return baseUrl + url;
    }

    // Try to use window.location.origin if available and it's HTTP
    if (typeof window !== "undefined" && window.location && window.location.origin) {
      const origin = window.location.origin;
      // Only use it if it's an actual HTTP origin
      if (origin.startsWith("http://") || origin.startsWith("https://")) {
        return origin + url;
      }
    }

    // Fallback: try to construct from window.location parts
    if (typeof window !== "undefined" && window.location) {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port;

      // Only construct if we have HTTP protocol
      if (protocol && (protocol === "http:" || protocol === "https:")) {
        const portPart = port ? `:${port}` : "";
        const resolved = `${protocol}//${hostname}${portPart}${url}`;
        return resolved;
      }
    }

    // Last resort fallback: assume localhost:3000
    const fallbackUrl = `http://localhost:3000${url}`;
    console.warn(
      `${logPrefix} Could not resolve origin for relative URL: ${url}, using fallback: ${fallbackUrl}`,
    );
    return fallbackUrl;
  }

  // Return as-is for other types of URLs
  return url;
}

/**
 * Parse GLB file and extract geometry directly without loading textures.
 * This is necessary because GLTFLoader hangs in JSDOM when textures fail to load.
 *
 * @param buffer - The ArrayBuffer containing the GLB data
 * @param logPrefix - Optional prefix for log messages (default: "[GeometryUtils]")
 * @returns GeometryResult with vertices and indices, or null if parsing fails
 */
export function parseGLBGeometry(
  buffer: ArrayBuffer,
  logPrefix: string = "[GeometryUtils]",
): GeometryResult | null {
  const dataView = new DataView(buffer);

  // Read GLB header
  const magic = dataView.getUint32(0, true);
  if (magic !== 0x46546c67) {
    // 'glTF' in little-endian
    console.error(`${logPrefix} Not a valid GLB file`);
    return null;
  }

  const version = dataView.getUint32(4, true);
  if (version !== 2) {
    console.error(`${logPrefix} Unsupported GLB version:`, version);
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
    console.error(`${logPrefix} Missing JSON or BIN chunk in GLB`);
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

          const posData = new Float32Array(
            binChunk as ArrayBuffer,
            posOffset,
            posAccessor.count * stride,
          );

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
              idxData = new Uint16Array(binChunk as ArrayBuffer, idxOffset, idxAccessor.count);
            } else if (idxAccessor.componentType === 5125) {
              // UNSIGNED_INT
              idxData = new Uint32Array(binChunk as ArrayBuffer, idxOffset, idxAccessor.count);
            } else {
              console.warn(
                `${logPrefix} Unsupported index component type: ${idxAccessor.componentType}`,
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
    console.warn(`${logPrefix} No geometry found in GLB`);
    return null;
  }

  console.log(
    `${logPrefix} Parsed GLB: ${allVertices.length / 3} vertices, ${allIndices.length / 3} triangles`,
  );

  return {
    vertices: new Float32Array(allVertices),
    indices: new Uint32Array(allIndices),
  };
}

/**
 * Extracts geometry from a GLB model file.
 * First attempts to use the custom GLB parser (for JSDOM compatibility),
 * then falls back to ModelLoader if available.
 *
 * @param src - The source URL of the GLB model
 * @param options - Options including logPrefix and optional ModelLoader
 * @returns GeometryResult with vertices and indices, or null if extraction fails
 */
export async function extractGeometryFromModel(
  src: string,
  options: ExtractGeometryOptions = {},
): Promise<GeometryResult | null> {
  const { logPrefix = "[GeometryUtils]", modelLoader } = options;

  try {
    // Resolve relative URLs to absolute URLs for server-side loading
    const resolvedSrc = resolveAssetURL(src, logPrefix);
    console.log(`${logPrefix} Loading model: ${src} (resolved to: ${resolvedSrc})`);

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
          `${logPrefix} Parsing GLB geometry from ${realmArrayBuffer.byteLength} bytes...`,
        );

        // Use our custom GLB parser that doesn't load textures
        const geometry = parseGLBGeometry(realmArrayBuffer, logPrefix);
        if (geometry) {
          return geometry;
        }

        console.warn(`${logPrefix} Custom GLB parser failed, model may not have geometry`);
        return null;
      } catch (fetchError) {
        console.error(`${logPrefix} Failed to fetch/parse GLB:`, fetchError);
        return null;
      }
    }

    // Fallback for browser environment - use ModelLoader if provided
    if (modelLoader) {
      const modelResult = (await modelLoader.load(resolvedSrc)) as ModelLoadResult | null;

      if (!modelResult || !modelResult.group) {
        console.error(`${logPrefix} Model result is invalid`);
        return null;
      }

      const { group } = modelResult;
      const allVertices: number[] = [];
      const allIndices: number[] = [];
      let vertexOffset = 0;

      // Traverse the group and extract geometry from meshes
      group.traverse((child: any) => {
        if (child.isMesh && child.geometry) {
          const geometry = child.geometry;
          const position = geometry.attributes.position;

          if (position) {
            // Get world matrix for this mesh
            child.updateWorldMatrix(true, false);
            const matrix = child.matrixWorld;

            // Extract and transform vertices
            for (let i = 0; i < position.count; i++) {
              const x = position.getX(i);
              const y = position.getY(i);
              const z = position.getZ(i);

              // Apply world transform
              const tx =
                x * matrix.elements[0] +
                y * matrix.elements[4] +
                z * matrix.elements[8] +
                matrix.elements[12];
              const ty =
                x * matrix.elements[1] +
                y * matrix.elements[5] +
                z * matrix.elements[9] +
                matrix.elements[13];
              const tz =
                x * matrix.elements[2] +
                y * matrix.elements[6] +
                z * matrix.elements[10] +
                matrix.elements[14];

              allVertices.push(tx, ty, tz);
            }

            // Extract indices
            if (geometry.index) {
              for (let i = 0; i < geometry.index.count; i++) {
                allIndices.push(geometry.index.getX(i) + vertexOffset);
              }
            } else {
              // Non-indexed geometry
              for (let i = 0; i < position.count; i++) {
                allIndices.push(i + vertexOffset);
              }
            }

            vertexOffset += position.count;
          }
        }
      });

      if (allVertices.length === 0) {
        console.warn(`${logPrefix} No geometry found in model`);
        return null;
      }

      return {
        vertices: new Float32Array(allVertices),
        indices: new Uint32Array(allIndices),
      };
    }

    console.error(`${logPrefix} No fetch available and no ModelLoader provided`);
    return null;
  } catch (error) {
    console.error(`${logPrefix} Error extracting geometry:`, error);
    return null;
  }
}
