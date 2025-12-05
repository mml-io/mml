import { MMLWebClient } from "mml-game-engine-client";
import { useEffect, useCallback, MutableRefObject } from "react";

import {
  bodyFromRemoteHolderElement,
  elementToPath,
  pathToElement,
  resolvePathsToElements,
  updateElementTransformInCode,
} from "../lib/domUtils";
import { TransformValues, useEditorStore } from "../state/editorStore";

/**
 * Hook that manages editor transform controller functionality.
 * Handles:
 * - Editor callbacks (selection, transform commit, drag state)
 * - Bidirectional selection sync between paths and viewport
 * - Gizmo mode/space/snapping sync
 * - Keyboard shortcuts for gizmo controls
 *
 * @param clientRef Reference to the MMLWebClient instance
 */
export function useEditorTransform(clientRef: MutableRefObject<MMLWebClient | null>) {
  const {
    remoteHolderElement,
    pathSelection,
    setSelectedPaths,
    clearSelection,
    gizmoMode,
    setGizmoMode,
    gizmoSpace,
    toggleGizmoSpace,
    snappingEnabled,
    setSnappingEnabled,
    setCode,
  } = useEditorStore();

  // Handle transform commit - update the code with new transform values
  const handleTransformCommit = useCallback(
    (element: HTMLElement, values: TransformValues) => {
      console.log("[useEditorTransform] handleTransformCommit called");
      console.log("[useEditorTransform] Element:", element.tagName, element.id ? `#${element.id}` : "");
      console.log("[useEditorTransform] Values:", values);

      const currentCode = useEditorStore.getState().code;
      if (!currentCode) {
        console.error("[useEditorTransform] No code in store");
        return;
      }

      const updatedCode = updateElementTransformInCode(currentCode, element, values);
      if (updatedCode) {
        console.log("[useEditorTransform] Code updated successfully");
        setCode(updatedCode);
      } else {
        console.error("[useEditorTransform] Failed to update code");
      }
    },
    [setCode],
  );

  // Set up editor callbacks when client is available
  const setupEditorCallbacks = useCallback(
    (client: MMLWebClient) => {
      console.log("[useEditorTransform] Setting up editor callbacks");
      
      client.setEditorCallbacks({
        onSelectionChange: (elements) => {
          console.log("[useEditorTransform] onSelectionChange callback fired");
          console.log("[useEditorTransform] Selected elements:", elements?.length ?? 0);
          
          // Convert elements to paths when selection changes from viewport
          const holder = useEditorStore.getState().remoteHolderElement;
          if (elements && elements.length > 0 && holder) {
            const paths = elements.map((el) => elementToPath(holder, el));
            console.log("[useEditorTransform] Setting paths:", paths);
            setSelectedPaths(paths);
          } else {
            console.log("[useEditorTransform] Clearing selection");
            clearSelection();
          }
        },
        onTransformCommit: (element, values) => {
          console.log("[useEditorTransform] onTransformCommit callback fired from client");
          handleTransformCommit(element, values as TransformValues);
        },
        onDragStateChange: (isDragging) => {
          console.log("[useEditorTransform] onDragStateChange:", isDragging);
        },
      });
    },
    [setSelectedPaths, clearSelection, handleTransformCommit],
  );

  // Sync selection to viewport when paths change
  useEffect(() => {
    const client = clientRef.current;
    if (!client || !remoteHolderElement) return;

    const elements = resolvePathsToElements(remoteHolderElement, pathSelection.selectedPaths);

    // Update selection in viewport
    if (elements.length > 0) {
      // Find the index of the last selected element
      let lastSelectedIndex = elements.length - 1;
      if (pathSelection.lastSelectedPath) {
        const lastSelectedElement = pathToElement(
          bodyFromRemoteHolderElement(remoteHolderElement),
          pathSelection.lastSelectedPath,
        );
        if (lastSelectedElement) {
          const idx = elements.indexOf(lastSelectedElement);
          if (idx !== -1) {
            lastSelectedIndex = idx;
          }
        }
      }
      client.setSelectedElements(elements, lastSelectedIndex);
    } else {
      client.clearSelection();
    }
  }, [pathSelection, remoteHolderElement, clientRef]);

  // Sync gizmo mode to viewport
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    client.setGizmoMode(gizmoMode);
  }, [gizmoMode, clientRef]);

  // Sync gizmo space to viewport
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    client.setGizmoSpace(gizmoSpace);
  }, [gizmoSpace, clientRef]);

  // Sync snapping to viewport
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    client.setSnapping(snappingEnabled);
  }, [snappingEnabled, clientRef]);

  // Keyboard shortcuts for gizmo modes
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case "w":
          setGizmoMode("translate");
          break;
        case "e":
          setGizmoMode("rotate");
          break;
        case "r":
          setGizmoMode("scale");
          break;
        case "q":
          toggleGizmoSpace();
          break;
        case "shift":
          setSnappingEnabled(true);
          break;
        case "escape":
          clearSelection();
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) {
        return;
      }

      if (event.key === "Shift") {
        setSnappingEnabled(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [setGizmoMode, toggleGizmoSpace, setSnappingEnabled, clearSelection]);

  return { setupEditorCallbacks };
}

