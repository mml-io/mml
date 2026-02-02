import { useCallback, useRef } from "react";
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { useGlbViewerStore } from "./store";
import type { AnimationCompatibility, ExternalAnimationFile, SkeletonInfo } from "./types";

function createFilteredClip(
  clip: THREE.AnimationClip,
  nodeNames: Set<string>,
): THREE.AnimationClip {
  const compatibleTracks = clip.tracks.filter((track: THREE.KeyframeTrack) => {
    const nodeName = track.name.split(".")[0];
    return nodeNames.has(nodeName);
  });
  return new THREE.AnimationClip(clip.name, clip.duration, compatibleTracks);
}

function checkAnimationCompatibility(
  animationClips: THREE.AnimationClip[],
  modelBoneNames: Set<string>,
): AnimationCompatibility {
  const animBoneNames = new Set<string>();
  animationClips.forEach((clip) => {
    clip.tracks.forEach((track) => {
      const boneName = track.name.split(".")[0];
      animBoneNames.add(boneName);
    });
  });

  let matchedBones = 0;
  animBoneNames.forEach((name) => {
    if (modelBoneNames.has(name)) {
      matchedBones++;
    }
  });

  return {
    compatible: matchedBones > 0 && matchedBones >= animBoneNames.size * 0.5,
    matchedBones,
    totalBones: animBoneNames.size,
  };
}

export interface UseAnimationPlayerResult {
  mixerRef: React.RefObject<THREE.AnimationMixer | null>;
  externalAnimClipsRef: React.MutableRefObject<Map<string, THREE.AnimationClip[]>>;
  playAnimation: (index: number, animations: THREE.AnimationClip[]) => void;
  stopAllAnimations: () => void;
  initMixer: (model: THREE.Group) => void;
  handleExternalAnimationLoaded: (
    uri: string,
    data: ArrayBuffer,
    files: ExternalAnimationFile[],
    skeletonInfo: SkeletonInfo | null,
  ) => void;
  loadExternalAnimation: (uri: string, alreadyLoaded: boolean) => boolean;
  removeExternalAnimation: (uri: string) => void;
  playExternalAnimation: (
    uri: string,
    clipIndex: number,
    skeletonInfo: SkeletonInfo | null,
  ) => void;
}

export function useAnimationPlayer(): UseAnimationPlayerResult {
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const externalAnimClipsRef = useRef<Map<string, THREE.AnimationClip[]>>(new Map());

  const activeAnimation = useGlbViewerStore((s) => s.activeAnimation);
  const activeExternalAnimation = useGlbViewerStore((s) => s.activeExternalAnimation);
  const setActiveAnimation = useGlbViewerStore((s) => s.setActiveAnimation);
  const setActiveExternalAnimation = useGlbViewerStore((s) => s.setActiveExternalAnimation);
  const setExternalAnimations = useGlbViewerStore((s) => s.setExternalAnimations);
  const setAnimationCompatibility = useGlbViewerStore((s) => s.setAnimationCompatibility);

  const stopAllAnimations = useCallback(() => {
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
    }
    setActiveAnimation(-1);
    setActiveExternalAnimation(null);
  }, [setActiveAnimation, setActiveExternalAnimation]);

  const initMixer = useCallback((model: THREE.Group) => {
    mixerRef.current = new THREE.AnimationMixer(model);
  }, []);

  const playAnimation = useCallback(
    (index: number, animations: THREE.AnimationClip[]) => {
      if (!mixerRef.current || !animations[index]) return;

      mixerRef.current.stopAllAction();
      setActiveExternalAnimation(null);

      if (index === activeAnimation) {
        setActiveAnimation(-1);
        return;
      }

      const action = mixerRef.current.clipAction(animations[index]);
      action.reset().play();
      setActiveAnimation(index);
    },
    [activeAnimation, setActiveAnimation, setActiveExternalAnimation],
  );

  const loadExternalAnimation = useCallback((uri: string, alreadyLoaded: boolean): boolean => {
    if (!uri || alreadyLoaded) return false;
    return true; // Caller should post message to vscode
  }, []);

  const handleExternalAnimationLoaded = useCallback(
    (
      uri: string,
      data: ArrayBuffer,
      files: ExternalAnimationFile[],
      skeletonInfo: SkeletonInfo | null,
    ) => {
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

          if (gltf.animations.length === 0) {
            console.warn("No animations found in external file");
            return;
          }

          const file = files.find((f) => f.uri === uri);
          if (!file) return;

          externalAnimClipsRef.current.set(uri, gltf.animations);

          const compatibility = checkAnimationCompatibility(
            gltf.animations,
            skeletonInfo?.boneNames || new Set(),
          );
          setAnimationCompatibility((prev) => new Map(prev).set(uri, compatibility));

          setExternalAnimations((prev) =>
            new Map(prev).set(uri, {
              file,
              clips: gltf.animations,
              clipInfos: gltf.animations.map((clip) => ({
                name: clip.name || "Unnamed",
                duration: clip.duration,
                trackCount: clip.tracks.length,
              })),
            }),
          );
        },
        undefined,
        (err) => {
          console.error("Failed to load external animation:", err);
        },
      );
    },
    [setAnimationCompatibility, setExternalAnimations],
  );

  const removeExternalAnimation = useCallback(
    (uri: string) => {
      if (activeExternalAnimation?.uri === uri) {
        if (mixerRef.current) {
          mixerRef.current.stopAllAction();
        }
        setActiveExternalAnimation(null);
      }

      setExternalAnimations((prev) => {
        const next = new Map(prev);
        next.delete(uri);
        return next;
      });

      externalAnimClipsRef.current.delete(uri);

      setAnimationCompatibility((prev) => {
        const next = new Map(prev);
        next.delete(uri);
        return next;
      });
    },
    [
      activeExternalAnimation,
      setActiveExternalAnimation,
      setExternalAnimations,
      setAnimationCompatibility,
    ],
  );

  const playExternalAnimation = useCallback(
    (uri: string, clipIndex: number, skeletonInfo: SkeletonInfo | null) => {
      if (!mixerRef.current) return;

      const clips = externalAnimClipsRef.current.get(uri);
      if (!clips || !clips[clipIndex]) return;

      mixerRef.current.stopAllAction();
      setActiveAnimation(-1);

      if (
        activeExternalAnimation?.uri === uri &&
        activeExternalAnimation?.clipIndex === clipIndex
      ) {
        setActiveExternalAnimation(null);
        return;
      }

      const clip = clips[clipIndex];
      const filteredClip = createFilteredClip(clip, skeletonInfo?.boneNames || new Set());

      const action = mixerRef.current.clipAction(filteredClip);
      action.reset().play();
      setActiveExternalAnimation({ uri, clipIndex });
    },
    [activeExternalAnimation, setActiveAnimation, setActiveExternalAnimation],
  );

  return {
    mixerRef,
    externalAnimClipsRef,
    playAnimation,
    stopAllAnimations,
    initMixer,
    handleExternalAnimationLoaded,
    loadExternalAnimation,
    removeExternalAnimation,
    playExternalAnimation,
  };
}
