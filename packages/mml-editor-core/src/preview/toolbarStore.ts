import { create } from "zustand";

import { DEFAULT_SNAPPING_CONFIG, type SnappingConfig } from "../shared/types";

export type GizmoMode = "translate" | "rotate" | "scale";

export type ToolbarState = {
  ready: boolean;
  gizmoMode: GizmoMode;
  snappingEnabled: boolean;
  snappingConfig: SnappingConfig;
  visualizersVisible: boolean;
  sidebarVisible: boolean;
};

export type ToolbarActions = {
  setReady: (ready: boolean) => void;
  setGizmoMode: (mode: GizmoMode) => void;
  setSnappingEnabled: (enabled: boolean) => void;
  toggleSnapping: () => void;
  setSnappingConfig: (patch: Partial<SnappingConfig>) => void;
  setVisualizersVisible: (visible: boolean) => void;
  toggleVisualizers: () => void;
  setSidebarVisible: (visible: boolean) => void;
  toggleSidebar: () => void;
  /** Bulk update for hydrating from persisted state */
  hydrate: (state: Partial<ToolbarState>) => void;
};

export type ToolbarStore = ToolbarState & ToolbarActions;

export const useToolbarStore = create<ToolbarStore>((set) => ({
  ready: false,
  gizmoMode: "translate",
  snappingEnabled: true,
  snappingConfig: DEFAULT_SNAPPING_CONFIG,
  visualizersVisible: true,
  sidebarVisible: true,

  setReady: (ready) => set({ ready }),
  setGizmoMode: (gizmoMode) => set({ gizmoMode }),
  setSnappingEnabled: (snappingEnabled) => set({ snappingEnabled }),
  toggleSnapping: () => set((s) => ({ snappingEnabled: !s.snappingEnabled })),
  setSnappingConfig: (patch) => set((s) => ({ snappingConfig: { ...s.snappingConfig, ...patch } })),
  setVisualizersVisible: (visualizersVisible) => set({ visualizersVisible }),
  toggleVisualizers: () => set((s) => ({ visualizersVisible: !s.visualizersVisible })),
  setSidebarVisible: (sidebarVisible) => set({ sidebarVisible }),
  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  hydrate: (state) => set(state),
}));
