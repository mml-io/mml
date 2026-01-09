import { type CodeRange, pathsEqual, type TransformValues } from "@mml-io/mml-editor-core";
import { EditableNetworkedDOM, IframeObservableDOMFactory } from "mml-game-engine-client";
import { create } from "zustand";

export type { CodeRange, TransformValues };

const STORAGE_KEY = "mml-editor-code";

function loadCodeFromStorage(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) || "";
}

function saveCodeToStorage(code: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, code);
}

export type GizmoSpace = "local" | "world";

/** Path-based selection state that survives DOM mutations */
export interface PathSelectionState {
  /** Array of element paths (child indices from body root) */
  selectedPaths: number[][];
  /** The path of the most recently selected element (for gizmo attachment) */
  lastSelectedPath: number[] | null;
}

export interface ContentSource {
  id: string;
  name: string;
  uri: string;
}

export interface EditorState {
  code: string;
  setCode: (code: string) => void;

  staticDocument: EditableNetworkedDOM;

  localDocument: EditableNetworkedDOM | null;
  setLocalDocument: (document: EditableNetworkedDOM) => void;

  remoteHolderElement: HTMLElement | null;
  setRemoteHolderElement: (element: HTMLElement) => void;

  viewportMode: "edit" | "play";
  setViewportMode: (mode: "edit" | "play") => void;

  // Path-based selection (survives DOM mutations)
  pathSelection: PathSelectionState;
  setSelectedPaths: (paths: number[][], lastSelected?: number[] | null) => void;
  addSelectedPath: (path: number[]) => void;
  removeSelectedPath: (path: number[]) => void;
  toggleSelectedPath: (path: number[], isMultiSelect: boolean) => void;
  clearSelection: () => void;

  // Monaco code range (derived from selection for editor highlighting)
  codeRange: CodeRange[] | null;
  setCodeRange: (range: CodeRange[] | null) => void;

  // Gizmo space (local only - mode is in shared toolbar store)
  gizmoSpace: GizmoSpace;
  setGizmoSpace: (space: GizmoSpace) => void;
  toggleGizmoSpace: () => void;

  contentSources: ContentSource[];
  addContentSource: (source: ContentSource) => void;
  removeContentSource: (id: string) => void;

  // Callbacks for viewport events (registered by FloatingClient)
  onTransformCommit: ((element: HTMLElement, values: TransformValues) => void) | null;
  setOnTransformCommit: (
    callback: ((element: HTMLElement, values: TransformValues) => void) | null,
  ) => void;

  onSelectionChange: ((elements: HTMLElement[] | null) => void) | null;
  setOnSelectionChange: (callback: ((elements: HTMLElement[] | null) => void) | null) => void;
}

export const useEditorStore = create<EditorState>((set, _get) => ({
  code: loadCodeFromStorage(),
  setCode: (code) => {
    saveCodeToStorage(code);
    set({ code });
  },

  staticDocument: new EditableNetworkedDOM("index.html", IframeObservableDOMFactory, false),
  localDocument: null,
  setLocalDocument: (document) => set({ localDocument: document }),

  viewportMode: "edit",
  setViewportMode: (mode) => set({ viewportMode: mode }),

  remoteHolderElement: null,
  setRemoteHolderElement: (element) => set({ remoteHolderElement: element }),

  // Path-based selection
  pathSelection: {
    selectedPaths: [],
    lastSelectedPath: null,
  },

  setSelectedPaths: (paths, lastSelected) =>
    set((state) => {
      const newLastSelected =
        lastSelected !== undefined ? lastSelected : paths[paths.length - 1] || null;
      const currentPaths = state.pathSelection.selectedPaths;
      const currentLast = state.pathSelection.lastSelectedPath;
      const pathsEq =
        paths.length === currentPaths.length &&
        paths.every((p, i) => {
          const curr = currentPaths[i];
          return p.length === curr.length && p.every((v, j) => v === curr[j]);
        });
      const lastEqual =
        newLastSelected === currentLast ||
        (newLastSelected !== null &&
          currentLast !== null &&
          newLastSelected.length === currentLast.length &&
          newLastSelected.every((v, j) => v === currentLast[j]));
      if (pathsEq && lastEqual) {
        return state;
      }
      return {
        pathSelection: {
          selectedPaths: paths,
          lastSelectedPath: newLastSelected,
        },
      };
    }),

  addSelectedPath: (path) =>
    set((state) => {
      const exists = state.pathSelection.selectedPaths.some((p) => pathsEqual(p, path));
      if (exists) return state;
      return {
        pathSelection: {
          selectedPaths: [...state.pathSelection.selectedPaths, path],
          lastSelectedPath: path,
        },
      };
    }),

  removeSelectedPath: (path) =>
    set((state) => {
      const newPaths = state.pathSelection.selectedPaths.filter((p) => !pathsEqual(p, path));
      const wasLastSelected = state.pathSelection.lastSelectedPath
        ? pathsEqual(state.pathSelection.lastSelectedPath, path)
        : false;
      return {
        pathSelection: {
          selectedPaths: newPaths,
          lastSelectedPath: wasLastSelected
            ? newPaths[newPaths.length - 1] || null
            : state.pathSelection.lastSelectedPath,
        },
      };
    }),

  toggleSelectedPath: (path, isMultiSelect) =>
    set((state) => {
      const existingIndex = state.pathSelection.selectedPaths.findIndex((p) => pathsEqual(p, path));
      const exists = existingIndex !== -1;

      if (isMultiSelect) {
        if (exists) {
          const newPaths = state.pathSelection.selectedPaths.filter((p) => !pathsEqual(p, path));
          newPaths.push(path);
          return {
            pathSelection: {
              selectedPaths: newPaths,
              lastSelectedPath: path,
            },
          };
        } else {
          return {
            pathSelection: {
              selectedPaths: [...state.pathSelection.selectedPaths, path],
              lastSelectedPath: path,
            },
          };
        }
      } else {
        return {
          pathSelection: {
            selectedPaths: [path],
            lastSelectedPath: path,
          },
        };
      }
    }),

  clearSelection: () =>
    set((state) => {
      if (
        state.pathSelection.selectedPaths.length === 0 &&
        state.pathSelection.lastSelectedPath === null
      ) {
        return state;
      }
      return {
        pathSelection: {
          selectedPaths: [],
          lastSelectedPath: null,
        },
      };
    }),

  // Monaco code range
  codeRange: null,
  setCodeRange: (range) => set({ codeRange: range }),

  // Gizmo space (local to this editor)
  gizmoSpace: "local",
  setGizmoSpace: (gizmoSpace) => set({ gizmoSpace }),
  toggleGizmoSpace: () =>
    set((state) => ({
      gizmoSpace: state.gizmoSpace === "local" ? "world" : "local",
    })),

  contentSources: [],
  addContentSource: (source) =>
    set((state) => ({ contentSources: [...state.contentSources, source] })),
  removeContentSource: (id) =>
    set((state) => ({
      contentSources: state.contentSources.filter((s) => s.id !== id),
    })),

  // Callbacks
  onTransformCommit: null,
  setOnTransformCommit: (callback) => set({ onTransformCommit: callback }),

  onSelectionChange: null,
  setOnSelectionChange: (callback) => set({ onSelectionChange: callback }),
}));
