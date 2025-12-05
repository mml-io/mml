import { createMMLGameClient, MMLWebClient } from "mml-game-engine-client";
import { useCallback, useEffect, useRef } from "react";

import { useEditorTransform } from "../hooks/useEditorTransform";
import { useEditorStore } from "../state/editorStore";

function EditorClient() {
  const clientRef = useRef<MMLWebClient | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    staticDocument,
    localDocument,
    viewportMode,
    setRemoteHolderElement,
  } = useEditorStore();

  // Use the editor transform hook for gizmo and selection management
  const { setupEditorCallbacks } = useEditorTransform(clientRef);

  const fitContainer = useCallback(() => {
    clientRef.current?.fitContainer();
  }, []);

  // Update client to show correct document as the viewport mode changes
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
    if (viewportMode === "edit") {
      client.connectToDocument(staticDocument, url);
    } else if (localDocument) {
      client.connectToDocument(localDocument, url);
    }
  }, [viewportMode, staticDocument, localDocument, clientRef.current]);

  // Initialize client
  useEffect(() => {
    let disposed = false;
    let runnerClient: MMLWebClient | null = null;

    createMMLGameClient().then(async (client: MMLWebClient) => {
      runnerClient = client;
      if (disposed) {
        runnerClient.dispose();
        return;
      }

      clientRef.current = runnerClient;

      // Set up editor callbacks via hook
      console.log("[FloatingClient] Setting up editor callbacks");
      setupEditorCallbacks(runnerClient);

      // Expose remote holder to store
      setTimeout(() => {
        if (disposed) return;

        setRemoteHolderElement(runnerClient!.remoteDocumentHolder);
      }, 50);

      // Force re-render to trigger other effects
      fitContainer();
    });

    return () => {
      disposed = true;
      if (runnerClient) {
        runnerClient.dispose();
        clientRef.current = null;
      }
    };
  }, [setupEditorCallbacks]);

  // Handle resize events
  useEffect(() => {
    window.addEventListener("resize", fitContainer);
    window.addEventListener("editor-layout", fitContainer);

    return () => {
      window.removeEventListener("resize", fitContainer);
      window.removeEventListener("editor-layout", fitContainer);
    };
  }, [fitContainer]);

  // Mount client element
  useEffect(() => {
    const client = clientRef.current;
    if (containerRef.current && client) {
      containerRef.current.appendChild(client.element);
      fitContainer();
    }
  }, [clientRef.current, fitContainer]);

  return (
    <div className="h-full w-full relative mobile-safe-top mobile-safe-left">
      <div ref={containerRef} className="h-full min-h-0 min-w-0 relative"></div>
    </div>
  );
}

export default EditorClient;
