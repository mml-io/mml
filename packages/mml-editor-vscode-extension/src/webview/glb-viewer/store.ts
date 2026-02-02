import * as THREE from "three";
import { create } from "zustand";

import type {
  AnimationCompatibility,
  ExternalAnimation,
  ExternalAnimationFile,
  ModelStats,
  SkeletonInfo,
  TextureInfo,
} from "./types";

export interface ColliderStats {
  vertices: number;
  triangles: number;
}

interface GlbViewerState {
  // UI state
  showBounds: boolean;
  showWireframe: boolean;
  showCollider: boolean;
  showSkeleton: boolean;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  collapsedSections: Set<string>;
  selectedTexture: TextureInfo | null;

  // Model state
  stats: ModelStats | null;
  skeletonInfo: SkeletonInfo | null;
  loading: boolean;
  error: string | null;
  fileName: string;

  // Collider state
  colliderStats: ColliderStats;

  // Animation state
  activeAnimation: number;
  activeExternalAnimation: { uri: string; clipIndex: number } | null;
  externalAnimationFiles: ExternalAnimationFile[];
  externalAnimations: Map<string, ExternalAnimation>;
  animationCompatibility: Map<string, AnimationCompatibility>;
  loadingExternalAnims: boolean;
}

interface GlbViewerActions {
  // UI actions
  toggleBounds: () => void;
  toggleWireframe: () => void;
  toggleCollider: () => void;
  toggleSkeleton: () => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  toggleSection: (section: string) => void;
  setSelectedTexture: (texture: TextureInfo | null) => void;

  // Model actions
  setStats: (stats: ModelStats | null) => void;
  setSkeletonInfo: (info: SkeletonInfo | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFileName: (name: string) => void;

  // Collider actions
  setColliderStats: (stats: ColliderStats) => void;

  // Animation actions
  setActiveAnimation: (index: number) => void;
  setActiveExternalAnimation: (anim: { uri: string; clipIndex: number } | null) => void;
  setExternalAnimationFiles: (files: ExternalAnimationFile[]) => void;
  setExternalAnimations: (
    updater:
      | Map<string, ExternalAnimation>
      | ((prev: Map<string, ExternalAnimation>) => Map<string, ExternalAnimation>),
  ) => void;
  setAnimationCompatibility: (
    updater:
      | Map<string, AnimationCompatibility>
      | ((prev: Map<string, AnimationCompatibility>) => Map<string, AnimationCompatibility>),
  ) => void;
  setLoadingExternalAnims: (loading: boolean) => void;

  // Reset actions
  resetAnimationState: () => void;
  resetModelState: () => void;
}

export type GlbViewerStore = GlbViewerState & GlbViewerActions;

// Refs that should not be in the store (Three.js objects that shouldn't trigger re-renders)
export interface GlbViewerRefs {
  mixer: THREE.AnimationMixer | null;
  model: THREE.Group | null;
  boxHelper: THREE.BoxHelper | null;
  animations: THREE.AnimationClip[];
  colliderMesh: THREE.LineSegments | null;
  externalAnimClips: Map<string, THREE.AnimationClip[]>;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  controls: import("three/examples/jsm/controls/OrbitControls.js").OrbitControls | null;
  clock: THREE.Clock;
}

export const createGlbViewerRefs = (): GlbViewerRefs => ({
  mixer: null,
  model: null,
  boxHelper: null,
  animations: [],
  colliderMesh: null,
  externalAnimClips: new Map(),
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  clock: new THREE.Clock(),
});

export const useGlbViewerStore = create<GlbViewerStore>((set) => ({
  // Initial UI state
  showBounds: false,
  showWireframe: false,
  showCollider: false,
  showSkeleton: false,
  sidebarCollapsed: false,
  sidebarWidth: 224,
  collapsedSections: new Set<string>(),
  selectedTexture: null,

  // Initial model state
  stats: null,
  skeletonInfo: null,
  loading: true,
  error: null,
  fileName: "",

  // Initial collider state
  colliderStats: { vertices: 0, triangles: 0 },

  // Initial animation state
  activeAnimation: -1,
  activeExternalAnimation: null,
  externalAnimationFiles: [],
  externalAnimations: new Map(),
  animationCompatibility: new Map(),
  loadingExternalAnims: false,

  // UI actions
  toggleBounds: () => set((state) => ({ showBounds: !state.showBounds })),
  toggleWireframe: () => set((state) => ({ showWireframe: !state.showWireframe })),
  toggleCollider: () => set((state) => ({ showCollider: !state.showCollider })),
  toggleSkeleton: () => set((state) => ({ showSkeleton: !state.showSkeleton })),
  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed;
      console.log("[GlbViewerStore] toggleSidebar:", state.sidebarCollapsed, "->", next);
      return { sidebarCollapsed: next };
    }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  toggleSection: (section: string) =>
    set((state) => {
      const next = new Set(state.collapsedSections);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return { collapsedSections: next };
    }),
  setSelectedTexture: (texture) => set({ selectedTexture: texture }),

  // Model actions
  setStats: (stats) => set({ stats }),
  setSkeletonInfo: (info) => set({ skeletonInfo: info }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setFileName: (name) => set({ fileName: name }),

  // Collider actions
  setColliderStats: (stats) => set({ colliderStats: stats }),

  // Animation actions
  setActiveAnimation: (index) => set({ activeAnimation: index }),
  setActiveExternalAnimation: (anim) => set({ activeExternalAnimation: anim }),
  setExternalAnimationFiles: (files) => set({ externalAnimationFiles: files }),
  setExternalAnimations: (updater) =>
    set((state) => ({
      externalAnimations:
        typeof updater === "function" ? updater(state.externalAnimations) : updater,
    })),
  setAnimationCompatibility: (updater) =>
    set((state) => ({
      animationCompatibility:
        typeof updater === "function" ? updater(state.animationCompatibility) : updater,
    })),
  setLoadingExternalAnims: (loading) => set({ loadingExternalAnims: loading }),

  // Reset actions
  resetAnimationState: () =>
    set({
      externalAnimations: new Map(),
      activeExternalAnimation: null,
      animationCompatibility: new Map(),
      activeAnimation: -1,
    }),
  resetModelState: () =>
    set({
      stats: null,
      skeletonInfo: null,
      loading: true,
      error: null,
      fileName: "",
      colliderStats: { vertices: 0, triangles: 0 },
    }),
}));
