import * as THREE from "three";

/**
 * post-processes a loaded GLTF scene graph to detect duplicate meshes
 * (same geometry + material) and replace them with InstancedMesh,
 * reducing draw calls from N to 1 per unique geometry + material pair.
 *
 * NOTE: instanced meshes are reparented as direct children of `root` with
 * baked world transforms. This means they will not follow if an intermediate
 * parent's transform is later modified (e.g. by animation). This is intended
 * for static scene geometry only.
 */
export function autoInstanceScene(root: THREE.Object3D, debug?: boolean): void {
  // 1) collect eligible meshes
  const eligibleMeshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh) return;
    const mesh = object as THREE.Mesh;
    // Skip SkinnedMesh
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    // Skip meshes with morph targets
    if (mesh.geometry.morphAttributes && Object.keys(mesh.geometry.morphAttributes).length > 0)
      return;
    // Skip meshes with multi-material arrays
    if (Array.isArray(mesh.material)) return;
    eligibleMeshes.push(mesh);
  });

  if (eligibleMeshes.length === 0) return;

  // 2) fingerprint meshes by geometry + material and group into buckets
  // key: "materialId|geometryFingerprint" -> meshes
  const buckets = new Map<string, THREE.Mesh[]>();

  // assign stable IDs to materials by reference so meshes sharing the
  // same material instance get the same bucket key
  const materialIds = new Map<THREE.Material, number>();
  let nextMaterialId = 0;

  for (const mesh of eligibleMeshes) {
    const mat = mesh.material as THREE.Material;
    if (!materialIds.has(mat)) {
      materialIds.set(mat, nextMaterialId++);
    }
    const materialId = materialIds.get(mat)!;
    const geomFingerprint = computeGeometryFingerprint(mesh.geometry);
    const key = `${materialId}|${geomFingerprint}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(mesh);
  }

  // 3) verify geometry equality within each bucket via full buffer comparison
  // sub-group into verified-equal sets
  const verifiedGroups: THREE.Mesh[][] = [];
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    const subGroups = verifyGeometryEquality(bucket);
    for (const subGroup of subGroups) {
      if (subGroup.length >= 2) {
        verifiedGroups.push(subGroup);
      }
    }
  }

  if (verifiedGroups.length === 0) return;

  // ensure world matrices are up-to-date
  root.updateWorldMatrix(true, true);
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();

  // 4) replace groups of 2+ with InstancedMesh
  let totalMeshesInstanced = 0;
  let totalInstancedMeshes = 0;
  let totalDuplicatesRemoved = 0;

  const tempMatrix = new THREE.Matrix4();
  // used to compensate mirrored instance matrices (flip is its own inverse)
  const flipMatrix = new THREE.Matrix4().makeScale(-1, 1, 1);

  for (const group of verifiedGroups) {
    // compute instance matrices and deduplicate overlapping transforms.
    // two meshes are considered true duplicates only when all 16 matrix
    // elements match within an epsilon — this covers position, rotation,
    // and scale so rotated/scaled copies at the same origin are kept.
    const seenMatrixKeys = new Set<string>();
    const uniqueMatrices: THREE.Matrix4[] = [];
    for (const mesh of group) {
      tempMatrix.multiplyMatrices(rootInverse, mesh.matrixWorld);
      const key = matrixKey(tempMatrix);
      if (!seenMatrixKeys.has(key)) {
        seenMatrixKeys.add(key);
        uniqueMatrices.push(tempMatrix.clone());
      }
    }

    const duplicatesInGroup = group.length - uniqueMatrices.length;
    totalDuplicatesRemoved += duplicatesInGroup;

    // after dedup, need at least 2 unique instances to justify instancing
    if (uniqueMatrices.length < 2) {
      // only 1 unique transform: leave the first mesh as-is, remove the rest
      for (let i = 1; i < group.length; i++) {
        group[i].removeFromParent();
        if (group[i].geometry !== group[0].geometry) {
          group[i].geometry.dispose();
        }
        const mat = group[i].material as THREE.Material;
        if (mat !== (group[0].material as THREE.Material)) {
          mat.dispose();
        }
      }
      continue;
    }

    // split by transform determinant sign. mirrored transforms (negative
    // determinant) flip triangle winding order. Three.js sets the front face
    // winding once per InstancedMesh (from its own matrixWorld determinant),
    // not per-instance. mixing mirrored and non-mirrored instances in the
    // same InstancedMesh causes the mirrored ones to show inner faces.
    const normalMatrices = uniqueMatrices.filter((m) => m.determinant() >= 0);
    const mirroredMatrices = uniqueMatrices.filter((m) => m.determinant() < 0);

    const referenceMesh = group[0];

    // remove all original meshes and dispose non-shared resources
    const keptGeometry = referenceMesh.geometry;
    const keptMaterial = referenceMesh.material as THREE.Material;
    for (const mesh of group) {
      mesh.removeFromParent();
      if (mesh.geometry !== keptGeometry) {
        mesh.geometry.dispose();
      }
      const mat = mesh.material as THREE.Material;
      if (mat !== keptMaterial) {
        mat.dispose();
      }
    }

    // create InstancedMesh for non-mirrored instances
    if (normalMatrices.length > 0) {
      const instancedMesh = new THREE.InstancedMesh(
        referenceMesh.geometry,
        referenceMesh.material as THREE.Material,
        normalMatrices.length,
      );
      instancedMesh.castShadow = referenceMesh.castShadow;
      instancedMesh.receiveShadow = referenceMesh.receiveShadow;
      for (let i = 0; i < normalMatrices.length; i++) {
        instancedMesh.setMatrixAt(i, normalMatrices[i]);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      root.add(instancedMesh);
      totalMeshesInstanced += normalMatrices.length;
      totalInstancedMeshes++;
    }

    // create InstancedMesh for mirrored instances
    if (mirroredMatrices.length > 0) {
      const instancedMesh = new THREE.InstancedMesh(
        referenceMesh.geometry,
        referenceMesh.material as THREE.Material,
        mirroredMatrices.length,
      );
      instancedMesh.castShadow = referenceMesh.castShadow;
      instancedMesh.receiveShadow = referenceMesh.receiveShadow;
      // apply a flip to the InstancedMesh itself so its matrixWorld has a
      // negative determinant, causing Three.js to reverse the front face
      // winding for all instances in this batch. compensate in each instance
      // matrix: final = root * flip * (flip * original) = root * original
      instancedMesh.scale.set(-1, 1, 1);
      for (let i = 0; i < mirroredMatrices.length; i++) {
        tempMatrix.multiplyMatrices(flipMatrix, mirroredMatrices[i]);
        instancedMesh.setMatrixAt(i, tempMatrix);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      root.add(instancedMesh);
      totalMeshesInstanced += mirroredMatrices.length;
      totalInstancedMeshes++;
    }
  }

  const drawCallsSaved = totalMeshesInstanced - totalInstancedMeshes;
  const duplicates =
    totalDuplicatesRemoved > 0
      ? `, removed ${totalDuplicatesRemoved} duplicate overlapping meshes`
      : "";
  if (debug) {
    console.log(`autoInstanceScene:
Instanced ${totalMeshesInstanced} meshes into ${totalInstancedMeshes} InstancedMesh objects
Savings: ${drawCallsSaved} draw calls
${duplicates}`);
  }
}

function computeGeometryFingerprint(geometry: THREE.BufferGeometry): string {
  const posAttr = geometry.getAttribute("position");
  const indexAttr = geometry.index;

  const vertexCount = posAttr ? posAttr.count : 0;
  const indexCount = indexAttr ? indexAttr.count : 0;

  let posHash = 0;
  if (posAttr) {
    posHash = hashTypedArray(posAttr.array as ArrayLike<number>);
  }

  let idxHash = 0;
  if (indexAttr) {
    idxHash = hashTypedArray(indexAttr.array as ArrayLike<number>);
  }

  // include normals and UVs in the fingerprint so meshes with the same
  // positions but different normals/UVs are not incorrectly grouped.
  const normalAttr = geometry.getAttribute("normal");
  let normalHash = 0;
  if (normalAttr) {
    normalHash = hashTypedArray(normalAttr.array as ArrayLike<number>);
  }

  const uvAttr = geometry.getAttribute("uv");
  let uvHash = 0;
  if (uvAttr) {
    uvHash = hashTypedArray(uvAttr.array as ArrayLike<number>);
  }

  return `${vertexCount}:${indexCount}:${posHash}:${idxHash}:${normalHash}:${uvHash}`;
}

// reusable buffer for reading IEEE 754 bit patterns from floats
const _hashFloat32 = new Float32Array(1);
const _hashDataView = new DataView(_hashFloat32.buffer);

function hashTypedArray(arr: ArrayLike<number>): number {
  // sample-based FNV-1a-like hash for performance on large buffers
  let hash = 2166136261;
  const len = arr.length;
  // sample up to 256 evenly-spaced elements for large arrays
  const step = len > 256 ? Math.floor(len / 256) : 1;
  for (let i = 0; i < len; i += step) {
    // read IEEE 754 bit pattern for lossless float hashing
    _hashFloat32[0] = arr[i];
    const intBits = _hashDataView.getInt32(0, true);
    hash ^= intBits;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0; // ensure unsigned
}

function verifyGeometryEquality(meshes: THREE.Mesh[]): THREE.Mesh[][] {
  const groups: THREE.Mesh[][] = [];

  for (const mesh of meshes) {
    let placed = false;
    for (const group of groups) {
      if (geometriesAreEqual(group[0].geometry, mesh.geometry)) {
        group.push(mesh);
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push([mesh]);
    }
  }

  return groups;
}

function geometriesAreEqual(a: THREE.BufferGeometry, b: THREE.BufferGeometry): boolean {
  // fast path: same reference
  if (a === b) return true;

  // compare all named attributes (position, normal, uv, etc.)
  const attrNamesA = Object.keys(a.attributes);
  const attrNamesB = Object.keys(b.attributes);
  if (attrNamesA.length !== attrNamesB.length) return false;

  for (const name of attrNamesA) {
    const attrA = a.getAttribute(name);
    const attrB = b.getAttribute(name);
    if (!attrA || !attrB) return false;
    if (attrA.count !== attrB.count) return false;
    if (attrA.itemSize !== attrB.itemSize) return false;
    if (!typedArraysEqual(attrA.array as ArrayLike<number>, attrB.array as ArrayLike<number>))
      return false;
  }

  // compare index
  const idxA = a.index;
  const idxB = b.index;
  if ((idxA === null) !== (idxB === null)) return false;
  if (idxA && idxB) {
    if (idxA.count !== idxB.count) return false;
    if (!typedArraysEqual(idxA.array as ArrayLike<number>, idxB.array as ArrayLike<number>))
      return false;
  }

  return true;
}

function typedArraysEqual(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const MATRIX_QUANTIZE = 1e5; // reciprocal of epsilon — quantize to 1e-5 grid

function matrixKey(m: THREE.Matrix4): string {
  const e = m.elements;
  let s = "" + Math.round(e[0] * MATRIX_QUANTIZE);
  for (let i = 1; i < 16; i++) {
    s += "," + Math.round(e[i] * MATRIX_QUANTIZE);
  }
  return s;
}
