import {
  bodyFromRemoteHolderElement,
  ensureHTMLDocument,
  getElementCodeRange,
  mmlPathToElement,
  stripScriptTags,
  updateElementTransformInCode,
  useMmlClient,
  useToolbarStore,
} from "@mml-io/mml-editor-core";
import { useCallback, useEffect, useRef, useState } from "react";

import { useEditorStore } from "../state/editorStore";

function EditorClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  const code = useEditorStore((s) => s.code);
  const setCode = useEditorStore((s) => s.setCode);
  const setCodeRange = useEditorStore((s) => s.setCodeRange);
  const setRemoteHolderElement = useEditorStore((s) => s.setRemoteHolderElement);
  const pathSelection = useEditorStore((s) => s.pathSelection);
  const setSelectedPaths = useEditorStore((s) => s.setSelectedPaths);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const gizmoSpace = useEditorStore((s) => s.gizmoSpace);
  const toggleGizmoSpace = useEditorStore((s) => s.toggleGizmoSpace);

  // Track if we're programmatically setting selection to avoid loops
  const settingSelectionRef = useRef(false);

  // Capture container on mount
  useEffect(() => {
    setContainer(containerRef.current);
  }, []);

  // Handle transform commits
  const handleTransformCommit = useCallback(
    (path: number[], values: Record<string, number | undefined>) => {
      const currentCode = useEditorStore.getState().code;
      const holder = useEditorStore.getState().remoteHolderElement;
      if (!currentCode || !holder) return;

      const body = bodyFromRemoteHolderElement(holder);
      if (!body) return;

      const el = mmlPathToElement(body, path);
      if (!el) return;

      const updated = updateElementTransformInCode(currentCode, el, values);
      if (updated) {
        setCode(updated);
      }
    },
    [setCode],
  );

  // Handle selection changes from viewport
  const handleSelectionChange = useCallback(
    (paths: number[][]) => {
      // Skip if we're in the middle of programmatically setting selection
      if (settingSelectionRef.current) return;
      if (paths.length > 0) {
        setSelectedPaths(paths);
      } else {
        clearSelection();
      }
    },
    [setSelectedPaths, clearSelection],
  );

  // Initialize MML client
  const mmlClient = useMmlClient({
    container,
    callbacks: {
      onSelectionChange: handleSelectionChange,
      onTransformCommit: handleTransformCommit,
    },
  });

  // Update store with remote holder element
  useEffect(() => {
    if (mmlClient.remoteHolderElement) {
      setRemoteHolderElement(mmlClient.remoteHolderElement);
    }
  }, [mmlClient.remoteHolderElement, setRemoteHolderElement]);

  // Sync gizmo space to client (gizmo mode is handled by useMmlClient via toolbar store)
  useEffect(() => {
    mmlClient.clientRef.current?.setGizmoSpace(gizmoSpace);
  }, [gizmoSpace, mmlClient.clientRef]);

  // Load content into client when code changes
  useEffect(() => {
    if (code && mmlClient.ready) {
      const sanitized = stripScriptTags(code);
      mmlClient.loadContent(ensureHTMLDocument(sanitized));
    }
  }, [code, mmlClient.ready, mmlClient.loadContent]);

  // Sync selection from store to client
  useEffect(() => {
    if (!mmlClient.ready) return;
    if (settingSelectionRef.current) return;
    settingSelectionRef.current = true;
    mmlClient.setSelectedPaths(pathSelection.selectedPaths);
    // Use microtask to reset flag after React's batch completes
    queueMicrotask(() => {
      settingSelectionRef.current = false;
    });
  }, [pathSelection.selectedPaths, mmlClient.ready, mmlClient.setSelectedPaths]);

  // Derive code highlight ranges from selected elements
  useEffect(() => {
    const holder = mmlClient.remoteHolderElement;
    if (!holder || !code) {
      setCodeRange(null);
      return;
    }

    const root = bodyFromRemoteHolderElement(holder);
    if (!root || pathSelection.selectedPaths.length === 0) {
      setCodeRange(null);
      return;
    }

    const ranges = pathSelection.selectedPaths
      .map((p) => mmlPathToElement(root, p))
      .filter((el): el is HTMLElement => !!el)
      .map((el) => getElementCodeRange(code, el))
      .filter((r): r is NonNullable<typeof r> => !!r);

    setCodeRange(ranges.length > 0 ? ranges : null);
  }, [code, pathSelection.selectedPaths, mmlClient.remoteHolderElement, setCodeRange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) {
        return;
      }

      const toolbar = useToolbarStore.getState();

      switch (event.key.toLowerCase()) {
        case "w":
          toolbar.setGizmoMode("translate");
          break;
        case "e":
          toolbar.setGizmoMode("rotate");
          break;
        case "r":
          toolbar.setGizmoMode("scale");
          break;
        case "q":
          toggleGizmoSpace();
          break;
        case "x":
          toolbar.toggleSnapping();
          break;
        case "g":
          toolbar.toggleVisualizers();
          break;
        case "escape":
          clearSelection();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleGizmoSpace, clearSelection]);

  return (
    <div className="h-full w-full relative mobile-safe-top mobile-safe-left">
      <div ref={containerRef} className="h-full min-h-0 min-w-0 relative" />
    </div>
  );
}

export default EditorClient;
