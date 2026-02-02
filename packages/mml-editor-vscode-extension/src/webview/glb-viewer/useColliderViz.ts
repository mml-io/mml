import RAPIER from "@dimforge/rapier3d-compat";
import { parseGLBGeometry } from "mml-game-systems-common";
import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";

import { useGlbViewerStore } from "./store";

export interface UseColliderVizResult {
  colliderMeshRef: React.RefObject<THREE.LineSegments | null>;
  createColliderVisualization: (glbBuffer: ArrayBuffer, scene: THREE.Scene) => void;
  cleanupCollider: (scene: THREE.Scene) => void;
}

export function useColliderViz(): UseColliderVizResult {
  const rapierWorldRef = useRef<RAPIER.World | null>(null);
  const colliderMeshRef = useRef<THREE.LineSegments | null>(null);

  const showCollider = useGlbViewerStore((s) => s.showCollider);
  const setColliderStats = useGlbViewerStore((s) => s.setColliderStats);

  useEffect(() => {
    RAPIER.init().then(() => {
      const gravity = new RAPIER.Vector3(0, -9.81, 0);
      rapierWorldRef.current = new RAPIER.World(gravity);
    });

    return () => {
      if (rapierWorldRef.current) {
        rapierWorldRef.current.free();
      }
    };
  }, []);

  const cleanupCollider = useCallback(
    (scene: THREE.Scene) => {
      if (colliderMeshRef.current) {
        scene.remove(colliderMeshRef.current);
        colliderMeshRef.current = null;
      }
      setColliderStats({ vertices: 0, triangles: 0 });
    },
    [setColliderStats],
  );

  const createColliderVisualization = useCallback(
    (glbBuffer: ArrayBuffer, scene: THREE.Scene) => {
      if (!rapierWorldRef.current) return;

      try {
        // Use the robust GLB parser from mml-game-systems-common
        const geometry = parseGLBGeometry(glbBuffer, "[ColliderViz]");
        if (!geometry) {
          console.warn("Failed to parse GLB geometry for collider visualization");
          return;
        }

        const { vertices, indices } = geometry;

        console.log(
          `Creating collider visualization: ${vertices.length / 3} vertices, ${indices.length / 3} triangles`,
        );

        const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed();
        const rigidbody = rapierWorldRef.current.createRigidBody(rigidBodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);
        if (!colliderDesc) {
          console.warn("Failed to create collider description");
          return;
        }
        rapierWorldRef.current.createCollider(colliderDesc, rigidbody);

        const { vertices: debugVertices, colors: debugColors } =
          rapierWorldRef.current.debugRender();

        const lineGeometry = new THREE.BufferGeometry();
        lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(debugVertices, 3));
        lineGeometry.setAttribute("color", new THREE.Float32BufferAttribute(debugColors, 4));

        const lineMaterial = new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.8,
        });

        const colliderMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
        colliderMesh.visible = false;
        colliderMeshRef.current = colliderMesh;
        scene.add(colliderMesh);

        setColliderStats({
          vertices: vertices.length / 3,
          triangles: indices.length / 3,
        });
      } catch (err) {
        console.warn("Failed to create collider visualization:", err);
      }
    },
    [setColliderStats],
  );

  useEffect(() => {
    if (colliderMeshRef.current) {
      colliderMeshRef.current.visible = showCollider;
    }
  }, [showCollider]);

  return {
    colliderMeshRef,
    createColliderVisualization,
    cleanupCollider,
  };
}
