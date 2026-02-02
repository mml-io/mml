import React, { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";

import { getVscodeApi } from "../utils/vscodeApi";
import { AnimationPanel } from "./AnimationPanel";
import { ExternalAnimPanel } from "./ExternalAnimPanel";
import { GlbViewerToolbar } from "./GlbViewerToolbar";
import { ModelStatsPanel } from "./ModelStatsPanel";
import { useGlbViewerStore } from "./store";
import { TexturePreviewModal } from "./TexturePreviewModal";
import { useAnimationPlayer } from "./useAnimationPlayer";
import { useColliderViz } from "./useColliderViz";
import { useGlbScene } from "./useGlbScene";
import { useModelLoader } from "./useModelLoader";
import { useSkeletonViz } from "./useSkeletonViz";

const vscode = getVscodeApi();

const minSidebarWidth = 180;
const maxSidebarWidth = 500;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function GlbViewer() {
  // Animation player hook (needs to be first for mixer ref)
  const {
    mixerRef,
    externalAnimClipsRef,
    playAnimation,
    initMixer,
    handleExternalAnimationLoaded,
    loadExternalAnimation,
    removeExternalAnimation,
    playExternalAnimation,
  } = useAnimationPlayer();

  // Scene setup hook
  const { containerRef, canvasRef, sceneRefs, resetCamera } = useGlbScene(mixerRef);

  // Model loader hook
  const { modelRef, boxHelperRef, animationsRef, loadModel } = useModelLoader();

  // Collider visualization hook
  const { colliderMeshRef, createColliderVisualization, cleanupCollider } = useColliderViz();

  // Skeleton visualization hook
  const { createSkeletonVisualization, cleanupSkeleton } = useSkeletonViz();

  // Get state from store
  const showBounds = useGlbViewerStore((s) => s.showBounds);
  const showWireframe = useGlbViewerStore((s) => s.showWireframe);
  const showCollider = useGlbViewerStore((s) => s.showCollider);
  const showSkeleton = useGlbViewerStore((s) => s.showSkeleton);
  const sidebarCollapsed = useGlbViewerStore((s) => s.sidebarCollapsed);
  const sidebarWidth = useGlbViewerStore((s) => s.sidebarWidth);
  const collapsedSections = useGlbViewerStore((s) => s.collapsedSections);
  const selectedTexture = useGlbViewerStore((s) => s.selectedTexture);
  const stats = useGlbViewerStore((s) => s.stats);
  const skeletonInfo = useGlbViewerStore((s) => s.skeletonInfo);
  const loading = useGlbViewerStore((s) => s.loading);
  const error = useGlbViewerStore((s) => s.error);
  const fileName = useGlbViewerStore((s) => s.fileName);
  const colliderStats = useGlbViewerStore((s) => s.colliderStats);
  const activeAnimation = useGlbViewerStore((s) => s.activeAnimation);
  const activeExternalAnimation = useGlbViewerStore((s) => s.activeExternalAnimation);
  const externalAnimationFiles = useGlbViewerStore((s) => s.externalAnimationFiles);
  const externalAnimations = useGlbViewerStore((s) => s.externalAnimations);
  const animationCompatibility = useGlbViewerStore((s) => s.animationCompatibility);
  const loadingExternalAnims = useGlbViewerStore((s) => s.loadingExternalAnims);

  // Get actions from store
  const toggleBounds = useGlbViewerStore((s) => s.toggleBounds);
  const toggleWireframe = useGlbViewerStore((s) => s.toggleWireframe);
  const toggleCollider = useGlbViewerStore((s) => s.toggleCollider);
  const toggleSkeleton = useGlbViewerStore((s) => s.toggleSkeleton);
  const toggleSidebar = useGlbViewerStore((s) => s.toggleSidebar);
  const setSidebarWidth = useGlbViewerStore((s) => s.setSidebarWidth);
  const toggleSection = useGlbViewerStore((s) => s.toggleSection);
  const setSelectedTexture = useGlbViewerStore((s) => s.setSelectedTexture);
  const setExternalAnimationFiles = useGlbViewerStore((s) => s.setExternalAnimationFiles);
  const setLoadingExternalAnims = useGlbViewerStore((s) => s.setLoadingExternalAnims);
  const resetAnimationState = useGlbViewerStore((s) => s.resetAnimationState);

  // Refs for values accessed in message handler
  const externalAnimationFilesRef = useRef(externalAnimationFiles);
  const skeletonInfoRef = useRef(skeletonInfo);
  const readySentRef = useRef(false);
  externalAnimationFilesRef.current = externalAnimationFiles;
  skeletonInfoRef.current = skeletonInfo;

  const handleResetCamera = useCallback(() => {
    resetCamera(modelRef.current);
  }, [resetCamera, modelRef]);

  const handleLoadModel = useCallback(
    (data: ArrayBuffer, name: string) => {
      const scene = sceneRefs.current.scene;
      if (!scene) return;

      // Cleanup existing
      cleanupCollider(scene);
      cleanupSkeleton(scene);
      resetAnimationState();
      externalAnimClipsRef.current.clear();

      // Create collider visualization from raw buffer
      createColliderVisualization(data, scene);

      loadModel(
        data,
        name,
        scene,
        () => {
          // GLTF loaded callback
        },
        (model, hasAnimationsOrRig) => {
          if (hasAnimationsOrRig) {
            initMixer(model);
          }
          createSkeletonVisualization(model, scene);
        },
        () => resetCamera(modelRef.current),
      );
    },
    [
      sceneRefs,
      cleanupCollider,
      cleanupSkeleton,
      resetAnimationState,
      externalAnimClipsRef,
      loadModel,
      createColliderVisualization,
      createSkeletonVisualization,
      initMixer,
      resetCamera,
      modelRef,
    ],
  );

  // Handle bounding box visibility
  useEffect(() => {
    if (boxHelperRef.current) {
      boxHelperRef.current.visible = showBounds;
    }
  }, [showBounds, boxHelperRef]);

  // Handle wireframe toggle
  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((mat) => {
              if ("wireframe" in mat) {
                (mat as THREE.MeshStandardMaterial).wireframe = showWireframe;
              }
            });
          }
        }
      });
    }
  }, [showWireframe, modelRef]);

  // Handle collider visibility
  useEffect(() => {
    if (colliderMeshRef.current) {
      colliderMeshRef.current.visible = showCollider;
    }
  }, [showCollider, colliderMeshRef]);

  // Message handler
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case "loadModel": {
          const binary = atob(message.data);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          handleLoadModel(bytes.buffer, message.fileName);
          break;
        }
        case "toggleBounds":
          toggleBounds();
          break;
        case "toggleWireframe":
          toggleWireframe();
          break;
        case "toggleCollider":
          toggleCollider();
          break;
        case "toggleSkeleton":
          toggleSkeleton();
          break;
        case "resetCamera":
          handleResetCamera();
          break;
        case "animationFilesResponse":
          setExternalAnimationFiles(message.files);
          setLoadingExternalAnims(false);
          break;
        case "externalAnimationLoaded": {
          const binary = atob(message.data);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          handleExternalAnimationLoaded(
            message.uri,
            bytes.buffer,
            externalAnimationFilesRef.current,
            skeletonInfoRef.current,
          );
          break;
        }
        case "externalAnimationError":
          console.error("Animation load error:", message.error);
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    handleLoadModel,
    handleResetCamera,
    toggleBounds,
    toggleWireframe,
    toggleCollider,
    toggleSkeleton,
    setExternalAnimationFiles,
    setLoadingExternalAnims,
    handleExternalAnimationLoaded,
  ]);

  // Send ready message on mount
  useEffect(() => {
    if (readySentRef.current) {
      return;
    }
    readySentRef.current = true;
    vscode.postMessage({ type: "ready" });
  }, []);

  const handlePlayAnimation = useCallback(
    (index: number) => {
      playAnimation(index, animationsRef.current);
    },
    [playAnimation, animationsRef],
  );

  const handleRequestAnimationFiles = useCallback(() => {
    setLoadingExternalAnims(true);
    vscode.postMessage({ type: "requestAnimationFiles" });
  }, [setLoadingExternalAnims]);

  const handleLoadExternalAnimation = useCallback(
    (uri: string) => {
      if (loadExternalAnimation(uri, externalAnimations.has(uri))) {
        vscode.postMessage({ type: "loadExternalAnimation", uri });
      }
    },
    [loadExternalAnimation, externalAnimations],
  );

  const handlePlayExternalAnimation = useCallback(
    (uri: string, clipIndex: number) => {
      playExternalAnimation(uri, clipIndex, skeletonInfo);
    },
    [playExternalAnimation, skeletonInfo],
  );

  const startSidebarDrag = useCallback(
    (startClientX: number) => {
      const startWidth = sidebarWidth;
      const onMove = (e: MouseEvent) => {
        const delta = startClientX - e.clientX;
        const nextWidth = clamp(startWidth + delta, minSidebarWidth, maxSidebarWidth);
        setSidebarWidth(nextWidth);
        e.preventDefault();
      };
      const onUp = (e: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        const delta = startClientX - e.clientX;
        const nextWidth = clamp(startWidth + delta, minSidebarWidth, maxSidebarWidth);
        setSidebarWidth(nextWidth);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [sidebarWidth, setSidebarWidth],
  );

  // Merge collider stats into display stats
  const displayStats = stats
    ? {
        ...stats,
        colliderVertices: colliderStats.vertices,
        colliderTriangles: colliderStats.triangles,
      }
    : null;

  return (
    <div className="flex h-full w-full flex-col bg-[var(--color-bg)] text-[11px]">
      <GlbViewerToolbar
        showBounds={showBounds}
        onToggleBounds={toggleBounds}
        showWireframe={showWireframe}
        onToggleWireframe={toggleWireframe}
        showCollider={showCollider}
        onToggleCollider={toggleCollider}
        showSkeleton={showSkeleton}
        onToggleSkeleton={toggleSkeleton}
        hasSkeleton={skeletonInfo?.isRigged ?? false}
        onResetCamera={handleResetCamera}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 3D Viewport */}
        <div ref={containerRef} className="relative flex-1 min-w-0">
          <canvas ref={canvasRef} className="block h-full w-full" />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg)]/80">
              <div className="text-[var(--color-text-muted)]">Loading...</div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg)]/80">
              <div className="text-center">
                <div className="mb-1 text-[var(--color-text)]">Failed to load model</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">{error}</div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Panel */}
        {!sidebarCollapsed ? (
          <div
            className="relative flex-shrink-0 overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-panel)]"
            style={{ width: sidebarWidth, minWidth: minSidebarWidth, maxWidth: maxSidebarWidth }}
          >
            <div
              data-drag-handle="sidebar"
              onMouseDown={(e) => {
                e.preventDefault();
                startSidebarDrag(e.clientX);
              }}
              className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize bg-transparent hover:bg-[var(--color-border)]/20"
            />
            <div className="overflow-y-auto p-2 h-full">
              <ModelStatsPanel
                stats={displayStats}
                fileName={fileName}
                skeletonInfo={skeletonInfo}
                collapsedSections={collapsedSections}
                onToggleSection={toggleSection}
                onSelectTexture={setSelectedTexture}
              />

              <AnimationPanel
                animations={stats?.animations || []}
                activeIndex={activeAnimation}
                collapsed={collapsedSections.has("animations")}
                onToggle={() => toggleSection("animations")}
                onPlayAnimation={handlePlayAnimation}
              />

              <ExternalAnimPanel
                skeletonInfo={skeletonInfo}
                externalFiles={externalAnimationFiles}
                externalAnimations={externalAnimations}
                animationCompatibility={animationCompatibility}
                activeExternalAnimation={activeExternalAnimation}
                collapsed={collapsedSections.has("externalAnims")}
                loading={loadingExternalAnims}
                onToggle={() => toggleSection("externalAnims")}
                onScan={handleRequestAnimationFiles}
                onLoadAnimation={handleLoadExternalAnimation}
                onRemoveAnimation={removeExternalAnimation}
                onPlayAnimation={handlePlayExternalAnimation}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Texture Modal */}
      {selectedTexture && (
        <TexturePreviewModal texture={selectedTexture} onClose={() => setSelectedTexture(null)} />
      )}
    </div>
  );
}
