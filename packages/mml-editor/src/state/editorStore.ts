import { EditableNetworkedDOM, IframeObservableDOMFactory } from "mml-game-engine-client";
import { create } from "zustand";

export type GizmoMode = "translate" | "rotate" | "scale" | null;

export interface SelectionState {
  nodeId: string | null;
  range: { startLine: number; endLine: number; startColumn: number; endColumn: number } | null;
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
  staticDocumentRevision: number;
  incrementStaticDocumentRevision: () => void;

  localDocument: EditableNetworkedDOM | null;
  setLocalDocument: (document: EditableNetworkedDOM) => void;

  remoteHolderElement: HTMLElement | null;
  setRemoteHolderElement: (element: HTMLElement) => void;

  viewportMode: "edit" | "play";
  setViewportMode: (mode: "edit" | "play") => void;
  
  selection: SelectionState;
  setSelection: (selection: SelectionState) => void;
  
  gizmoMode: GizmoMode;
  setGizmoMode: (mode: GizmoMode) => void;
  
  contentSources: ContentSource[];
  addContentSource: (source: ContentSource) => void;
  removeContentSource: (id: string) => void;
  
  // For viewport communication (handlers registered by the host/adapter)
  viewportHandlers: {
    highlightNode: (nodeId: string) => void;
    selectNode: (nodeId: string) => void;
  };
  setViewportHandlers: (handlers: Partial<EditorState["viewportHandlers"]>) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  code: "",
  setCode: (code) => set({ code }),
  
  staticDocument: new EditableNetworkedDOM("index.html", IframeObservableDOMFactory, false),
  staticDocumentRevision: 0,
  incrementStaticDocumentRevision: () => set((state) => ({ staticDocumentRevision: state.staticDocumentRevision + 1 })),

  localDocument: null,
  setLocalDocument: (document) => set({ localDocument: document }),

  viewportMode: "edit",
  setViewportMode: (mode) => set({ viewportMode: mode }),

  remoteHolderElement: null,
  setRemoteHolderElement: (element) => set({ remoteHolderElement: element }),

  selection: { nodeId: null, range: null },
  setSelection: (selection) => set({ selection }),
  
  gizmoMode: "translate",
  setGizmoMode: (gizmoMode) => set({ gizmoMode }),
  
  contentSources: [],
  addContentSource: (source) =>
    set((state) => ({ contentSources: [...state.contentSources, source] })),
  removeContentSource: (id) =>
    set((state) => ({
      contentSources: state.contentSources.filter((s) => s.id !== id),
    })),
    
  viewportHandlers: {
    highlightNode: () => {},
    selectNode: () => {},
  },
  setViewportHandlers: (handlers) =>
    set((state) => ({
      viewportHandlers: { ...state.viewportHandlers, ...handlers },
    })),
}));

