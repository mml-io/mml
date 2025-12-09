import { MMLWebClient } from "mml-game-engine-client";
import { MutableRefObject, useCallback, useEffect } from "react";

import {
  bodyFromRemoteHolderElement,
  elementToPath,
  getElementCodeRange,
  pathToElement,
  resolvePathsToElements,
  updateElementTransformInCode,
} from "../lib/domUtils";
import { TransformValues, useEditorStore } from "../state/editorStore";

const applyTransformValuesToElement = (el: HTMLElement, values: TransformValues) => {
  const maybeSet = (name: keyof TransformValues) => {
    const val = values[name];
    if (val === undefined || val === null) {
      el.removeAttribute(name);
    } else {
      el.setAttribute(name, val.toString());
    }
  };

  maybeSet("x");
  maybeSet("y");
  maybeSet("z");
  maybeSet("rx");
  maybeSet("ry");
  maybeSet("rz");
  maybeSet("sx");
  maybeSet("sy");
  maybeSet("sz");
};

/**
 * Hook that manages editor transform controller functionality.
 * Handles:
 * - Editor callbacks (selection, transform commit, drag state)
 * - Bidirectional selection sync between paths and viewport
 * - Gizmo mode/space/snapping sync
 * - Visualizer visibility sync
 * - Keyboard shortcuts for gizmo controls and visualizer toggle
 *
 * @param clientRef Reference to the MMLWebClient instance
 */
export function useEditorTransform(clientRef: MutableRefObject<MMLWebClient | null>) {
  const {
    remoteHolderElement,
    pathSelection,
    setSelectedPaths,
    clearSelection,
    code,
    gizmoMode,
    setGizmoMode,
    gizmoSpace,
    toggleGizmoSpace,
    snappingEnabled,
    snappingConfig,
    setSnappingEnabled,
    visualizersVisible,
    toggleVisualizersVisible,
    setCode,
    setCodeRange,
  } = useEditorStore();

  // Handle transform commit - update the code with new transform values
  const handleTransformCommit = useCallback(
    (element: HTMLElement, values: TransformValues) => {
      console.log("[useEditorTransform] handleTransformCommit called");
      console.log(
        "[useEditorTransform] Element:",
        element.tagName,
        element.id ? `#${element.id}` : "",
      );
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
        onTransformPreview: (element, values) => {
          const holder = useEditorStore.getState().remoteHolderElement;
          if (!holder) return;

          const path = elementToPath(holder, element);
          const target = pathToElement(bodyFromRemoteHolderElement(holder), path);
          if (!target) return;

          applyTransformValuesToElement(target, values);
        },
        onTransformCommit: (element, values) => {
          console.log("[useEditorTransform] onTransformCommit callback fired from client");
          handleTransformCommit(element, values as TransformValues);
        },
        onDragStateChange: (isDragging) => {
          console.log("[useEditorTransform] onDragStateChange:", isDragging);
        },
      });

      // Apply initial gizmo state to freshly created client
      const state = useEditorStore.getState();
      client.setGizmoMode(state.gizmoMode);
      client.setGizmoSpace(state.gizmoSpace);
      client.setSnapping(state.snappingEnabled);
      client.setSnappingConfig(state.snappingConfig);
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

  // Derive code highlight ranges from all selected elements
  useEffect(() => {
    if (!remoteHolderElement || !code) {
      setCodeRange(null);
      return;
    }

    const root = bodyFromRemoteHolderElement(remoteHolderElement);
    const targetPaths = pathSelection.selectedPaths;
    if (!root || targetPaths.length === 0) {
      setCodeRange(null);
      return;
    }

    const ranges = targetPaths
      .map((p) => pathToElement(root, p))
      .filter((el): el is HTMLElement => !!el)
      .map((el) => getElementCodeRange(code, el))
      .filter((r): r is NonNullable<typeof r> => !!r);

    setCodeRange(ranges.length > 0 ? ranges : null);
  }, [code, pathSelection, remoteHolderElement, setCodeRange]);

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

  // Sync snapping configuration to viewport
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    client.setSnappingConfig(snappingConfig);
  }, [snappingConfig, clientRef]);

  // Sync visualizers visibility to viewport
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    client.setVisualizersVisible(visualizersVisible);
  }, [visualizersVisible, clientRef]);

  // Keyboard shortcuts for gizmo modes and visualizer toggle
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
        case "g":
          toggleVisualizersVisible();
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
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    setGizmoMode,
    toggleGizmoSpace,
    setSnappingEnabled,
    clearSelection,
    toggleVisualizersVisible,
  ]);

  return { setupEditorCallbacks };
}
