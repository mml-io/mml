export type HostToEditorMessage =
  | { type: "updateCode"; code: string }
  | { type: "updateSelection"; nodeId: string | null; range: any } // Refine range type
  | { type: "setGizmoMode"; mode: "translate" | "rotate" | "scale" | null }
  | { type: "addContentSource"; source: { id: string; name: string; uri: string } }
  | { type: "removeContentSource"; id: string };

export type EditorToHostMessage =
  | { type: "ready" }
  | { type: "codeChanged"; code: string }
  | { type: "selectionChanged"; nodeId: string | null; range: any }
  | { type: "gizmoModeChanged"; mode: "translate" | "rotate" | "scale" | null };

export interface HostChannel {
  postMessage(message: EditorToHostMessage): void;
  onMessage(callback: (message: HostToEditorMessage) => void): () => void; // Returns unsubscribe
}

