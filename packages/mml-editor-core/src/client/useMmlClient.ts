import { useCallback, useEffect, useRef, useState } from "react";

import { useToolbarStore } from "../preview/toolbarStore";
import {
  bodyFromRemoteHolderElement,
  elementAtPath,
  pathToElement,
} from "../shared/remoteHolderUtils";
import type { TransformValues } from "../shared/types";

export type MmlClientCallbacks = {
  onSelectionChange?: (paths: number[][]) => void;
  onTransformCommit?: (path: number[], values: TransformValues) => void;
};

export type UseMmlClientOptions = {
  /** Container element to mount the client into */
  container: HTMLElement | null;
  /** Callbacks for selection and transform events */
  callbacks?: MmlClientCallbacks;
};

export type UseMmlClientResult = {
  clientRef: React.MutableRefObject<import("mml-game-engine-client").MMLWebClient | null>;
  staticDocument: import("mml-game-engine-client").EditableNetworkedDOM | null;
  remoteHolderElement: HTMLElement | null;
  ready: boolean;
  /** Load HTML content into the static document */
  loadContent: (html: string) => void;
  /** Fit client to container */
  fitContainer: () => void;
  /** Set selected elements by paths */
  setSelectedPaths: (paths: number[][]) => void;
  /** Clear selection */
  clearSelection: () => void;
};

function getElementPath(holder: HTMLElement | null, el: HTMLElement): number[] {
  const body = bodyFromRemoteHolderElement(holder!);
  return pathToElement(body, el);
}

function getElementByPath(holder: HTMLElement | null, path: number[]): HTMLElement | null {
  const body = bodyFromRemoteHolderElement(holder!);
  return elementAtPath(body, path);
}

export function useMmlClient(options: UseMmlClientOptions): UseMmlClientResult {
  const { container, callbacks } = options;

  const clientRef = useRef<import("mml-game-engine-client").MMLWebClient | null>(null);
  const staticDocumentRef = useRef<import("mml-game-engine-client").EditableNetworkedDOM | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [remoteHolderElement, setRemoteHolderElement] = useState<HTMLElement | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Boot client
  useEffect(() => {
    if (!container) return;

    let cancelled = false;
    let client: import("mml-game-engine-client").MMLWebClient | null = null;

    (async () => {
      const { createMMLGameClient, EditableNetworkedDOM, IframeObservableDOMFactory } =
        await import("mml-game-engine-client");

      if (cancelled) return;

      const staticDocument = new EditableNetworkedDOM("preview", IframeObservableDOMFactory, false);
      client = await createMMLGameClient({ mode: "editor" });

      if (cancelled) {
        client.dispose();
        return;
      }

      // At this point client is guaranteed non-null. Capture reference for callbacks.
      const mmlClient = client;

      mmlClient.element.style.cssText = "width:100%;height:100%;position:absolute;inset:0;";
      container.appendChild(mmlClient.element);
      mmlClient.fitContainer();
      mmlClient.connectToDocument(staticDocument, "wss://mml-preview.local");

      // Setup editor callbacks
      mmlClient.setEditorCallbacks({
        onSelectionChange: (elements) => {
          if (!elements?.length) {
            callbacksRef.current?.onSelectionChange?.([]);
            return;
          }
          const holder = mmlClient.remoteDocumentHolder;
          const paths = elements.map((el) => getElementPath(holder, el));
          callbacksRef.current?.onSelectionChange?.(paths);
        },
        onTransformCommit: (element, values) => {
          const holder = mmlClient.remoteDocumentHolder;
          const path = getElementPath(holder, element);
          callbacksRef.current?.onTransformCommit?.(path, values as TransformValues);
        },
      });

      // Apply initial toolbar state
      const toolbar = useToolbarStore.getState();
      mmlClient.setGizmoMode(toolbar.gizmoMode);
      mmlClient.setSnapping(toolbar.snappingEnabled);
      mmlClient.setSnappingConfig(toolbar.snappingConfig);
      mmlClient.setVisualizersVisible(toolbar.visualizersVisible);

      clientRef.current = mmlClient;
      staticDocumentRef.current = staticDocument;
      setRemoteHolderElement(mmlClient.remoteDocumentHolder);
      useToolbarStore.getState().setReady(true);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (client) {
        client.dispose();
        clientRef.current = null;
      }
    };
  }, [container]);

  // Sync toolbar state to client
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    return useToolbarStore.subscribe((state, prev) => {
      if (state.gizmoMode !== prev.gizmoMode) client.setGizmoMode(state.gizmoMode);
      if (state.snappingEnabled !== prev.snappingEnabled) client.setSnapping(state.snappingEnabled);
      if (state.snappingConfig !== prev.snappingConfig)
        client.setSnappingConfig(state.snappingConfig);
      if (state.visualizersVisible !== prev.visualizersVisible)
        client.setVisualizersVisible(state.visualizersVisible);
    });
  }, [ready]);

  // Resize on window/sidebar changes
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    const handleResize = () => client.fitContainer();
    window.addEventListener("resize", handleResize);

    return useToolbarStore.subscribe((state, prev) => {
      if (state.sidebarVisible !== prev.sidebarVisible) {
        setTimeout(handleResize, 0);
      }
    });
  }, [ready]);

  const loadContent = useCallback((html: string) => {
    staticDocumentRef.current?.load(html);
  }, []);

  const fitContainer = useCallback(() => {
    clientRef.current?.fitContainer();
  }, []);

  const setSelectedPaths = useCallback(
    (paths: number[][]) => {
      const client = clientRef.current;
      if (!client || !remoteHolderElement) return;

      const elements = paths
        .map((path) => getElementByPath(remoteHolderElement, path))
        .filter((el): el is HTMLElement => !!el);

      if (elements.length === 0) {
        client.clearSelection();
      } else {
        client.setSelectedElements(elements);
      }
    },
    [remoteHolderElement],
  );

  const clearSelectionFn = useCallback(() => {
    clientRef.current?.clearSelection();
  }, []);

  return {
    clientRef,
    staticDocument: staticDocumentRef.current,
    remoteHolderElement,
    ready,
    loadContent,
    fitContainer,
    setSelectedPaths,
    clearSelection: clearSelectionFn,
  };
}
