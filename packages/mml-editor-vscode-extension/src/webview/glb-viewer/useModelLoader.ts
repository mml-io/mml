import { useCallback, useRef } from "react";
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { SLOT_LABELS } from "./constants";
import { useGlbViewerStore } from "./store";
import { extractTextureDataUrl, getTextureFormat, getTextureImageSize } from "./texture-utils";
import type { AnimationInfo, TextureInfo } from "./types";

export interface UseModelLoaderResult {
  modelRef: React.MutableRefObject<THREE.Group | null>;
  boxHelperRef: React.MutableRefObject<THREE.BoxHelper | null>;
  animationsRef: React.MutableRefObject<THREE.AnimationClip[]>;
  loadModel: (
    data: ArrayBuffer,
    name: string,
    scene: THREE.Scene,
    onGltfLoaded: (gltf: GLTF) => void,
    onMixerReady: (model: THREE.Group, hasAnimationsOrRig: boolean) => void,
    onResetCamera: () => void,
  ) => void;
  cleanupModel: (scene: THREE.Scene) => void;
}

export function useModelLoader(): UseModelLoaderResult {
  const modelRef = useRef<THREE.Group | null>(null);
  const boxHelperRef = useRef<THREE.BoxHelper | null>(null);
  const animationsRef = useRef<THREE.AnimationClip[]>([]);

  const setStats = useGlbViewerStore((s) => s.setStats);
  const setSkeletonInfo = useGlbViewerStore((s) => s.setSkeletonInfo);
  const setLoading = useGlbViewerStore((s) => s.setLoading);
  const setError = useGlbViewerStore((s) => s.setError);
  const setFileName = useGlbViewerStore((s) => s.setFileName);

  const cleanupModel = useCallback((scene: THREE.Scene) => {
    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }
    if (boxHelperRef.current) {
      scene.remove(boxHelperRef.current);
      boxHelperRef.current = null;
    }
    animationsRef.current = [];
  }, []);

  const loadModel = useCallback(
    (
      data: ArrayBuffer,
      name: string,
      scene: THREE.Scene,
      onGltfLoaded: (gltf: GLTF) => void,
      onMixerReady: (model: THREE.Group, hasAnimationsOrRig: boolean) => void,
      onResetCamera: () => void,
    ) => {
      setFileName(name);
      setLoading(true);
      setError(null);

      cleanupModel(scene);

      const loader = new GLTFLoader();

      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
      loader.setDRACOLoader(dracoLoader);
      loader.setMeshoptDecoder(MeshoptDecoder);

      const blob = new Blob([data], { type: "model/gltf-binary" });
      const url = URL.createObjectURL(blob);

      loader.load(
        url,
        (gltf) => {
          URL.revokeObjectURL(url);

          modelRef.current = gltf.scene;
          scene.add(gltf.scene);

          animationsRef.current = gltf.animations;

          let vertices = 0;
          let triangles = 0;
          let meshes = 0;
          const materials = new Set<THREE.Material>();
          const textures: TextureInfo[] = [];
          const textureSet = new Set<THREE.Texture>();

          gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              meshes++;

              if (mesh.geometry) {
                const position = mesh.geometry.attributes.position;
                if (position) {
                  vertices += position.count;
                }
                if (mesh.geometry.index) {
                  triangles += mesh.geometry.index.count / 3;
                } else if (position) {
                  triangles += position.count / 3;
                }
              }

              if (mesh.material) {
                const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                mats.forEach((mat) => {
                  materials.add(mat);
                  const texProps = [
                    "map",
                    "normalMap",
                    "roughnessMap",
                    "metalnessMap",
                    "aoMap",
                    "emissiveMap",
                    "alphaMap",
                    "bumpMap",
                    "displacementMap",
                  ];
                  texProps.forEach((prop) => {
                    const tex = (mat as unknown as Record<string, THREE.Texture | undefined>)[prop];
                    if (tex && !textureSet.has(tex)) {
                      const imageSize = tex.image ? getTextureImageSize(tex.image) : null;
                      textureSet.add(tex);
                      textures.push({
                        name: tex.name || `Texture ${textures.length + 1}`,
                        width: imageSize?.width ?? 0,
                        height: imageSize?.height ?? 0,
                        format: getTextureFormat(tex),
                        slot: prop,
                        dataUrl: extractTextureDataUrl(tex, 1024),
                        thumbnailUrl: extractTextureDataUrl(tex, 64),
                      });
                    }
                  });
                });
              }
            }
          });

          const box = new THREE.Box3().setFromObject(gltf.scene);
          const boxMin = box.min;
          const boxMax = box.max;
          const boxSize = box.getSize(new THREE.Vector3());

          const boxHelper = new THREE.BoxHelper(gltf.scene, 0x00ff00);
          boxHelper.visible = false;
          boxHelperRef.current = boxHelper;
          scene.add(boxHelper);

          const animations: AnimationInfo[] = gltf.animations.map((clip) => ({
            name: clip.name || "Unnamed",
            duration: clip.duration,
            trackCount: clip.tracks.length,
          }));

          // Detect skeleton/rigging
          let isRigged = false;
          const boneNames = new Set<string>();
          let rootBone: string | null = null;
          gltf.scene.traverse((child) => {
            if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
              isRigged = true;
              const skinnedMesh = child as THREE.SkinnedMesh;
              if (skinnedMesh.skeleton) {
                const boneSet = new Set(skinnedMesh.skeleton.bones);
                skinnedMesh.skeleton.bones.forEach((bone) => {
                  boneNames.add(bone.name);
                  // Find root bone (bone with no parent in skeleton)
                  if (!rootBone && (!bone.parent || !boneSet.has(bone.parent as THREE.Bone))) {
                    rootBone = bone.name;
                  }
                });
              }
            }
          });
          const skelInfo = isRigged
            ? { isRigged, boneNames, boneCount: boneNames.size, rootBone }
            : null;
          setSkeletonInfo(skelInfo);

          setStats({
            fileSize: data.byteLength,
            vertices,
            triangles: Math.floor(triangles),
            meshes,
            materials: materials.size,
            textures,
            animations,
            boundingBox: {
              min: { x: boxMin.x, y: boxMin.y, z: boxMin.z },
              max: { x: boxMax.x, y: boxMax.y, z: boxMax.z },
              size: { x: boxSize.x, y: boxSize.y, z: boxSize.z },
            },
            colliderVertices: 0,
            colliderTriangles: 0,
          });

          onGltfLoaded(gltf);
          onMixerReady(gltf.scene, gltf.animations.length > 0 || isRigged);
          onResetCamera();
          setLoading(false);
        },
        undefined,
        (err) => {
          URL.revokeObjectURL(url);
          console.error("Failed to load GLB:", err);
          setError(err instanceof Error ? err.message : "Failed to load model");
          setLoading(false);
        },
      );
    },
    [cleanupModel, setFileName, setLoading, setError, setSkeletonInfo, setStats],
  );

  return {
    modelRef,
    boxHelperRef,
    animationsRef,
    loadModel,
    cleanupModel,
  };
}

// Re-export for convenience
export { SLOT_LABELS };
