import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";

import { useGlbViewerStore } from "./store";

export interface UseSkeletonVizResult {
  skeletonHelpersRef: React.RefObject<THREE.SkeletonHelper[]>;
  createSkeletonVisualization: (model: THREE.Group, scene: THREE.Scene) => void;
  cleanupSkeleton: (scene: THREE.Scene) => void;
}

export function useSkeletonViz(): UseSkeletonVizResult {
  const skeletonHelpersRef = useRef<THREE.SkeletonHelper[]>([]);

  const showSkeleton = useGlbViewerStore((s) => s.showSkeleton);

  const cleanupSkeleton = useCallback((scene: THREE.Scene) => {
    for (const helper of skeletonHelpersRef.current) {
      scene.remove(helper);
      helper.dispose();
    }
    skeletonHelpersRef.current = [];
  }, []);

  const createSkeletonVisualization = useCallback((model: THREE.Group, scene: THREE.Scene) => {
    // Find all skinned meshes and create skeleton helpers
    const helpers: THREE.SkeletonHelper[] = [];

    model.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const skinnedMesh = child as THREE.SkinnedMesh;
        if (skinnedMesh.skeleton && skinnedMesh.skeleton.bones.length > 0) {
          // Find the root bone (first bone in the skeleton)
          const rootBone = skinnedMesh.skeleton.bones[0];
          // Go up to find the actual root (in case skeleton root is not at top)
          let root: THREE.Object3D = rootBone;
          while (root.parent && root.parent !== model && root.parent !== scene) {
            root = root.parent;
          }

          const helper = new THREE.SkeletonHelper(root);
          helper.visible = false;
          helpers.push(helper);
          scene.add(helper);
        }
      }
    });

    skeletonHelpersRef.current = helpers;
  }, []);

  useEffect(() => {
    for (const helper of skeletonHelpersRef.current) {
      helper.visible = showSkeleton;
    }
  }, [showSkeleton]);

  return {
    skeletonHelpersRef,
    createSkeletonVisualization,
    cleanupSkeleton,
  };
}
