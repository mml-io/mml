import { createMMLGameClient, MMLWebClient } from "mml-game-engine-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "../state/editorStore";

function EditorClient() {
  const [client, setClient] = useState<MMLWebClient | null>(null);

  const internalRef = useRef<HTMLDivElement>(null);
  const elementRef = internalRef;

  const fitContainer = useCallback(() => {
    client?.fitContainer();
  }, [client]);

  const { staticDocument, localDocument, viewportMode, incrementStaticDocumentRevision, setRemoteHolderElement } = useEditorStore();

  // Update client to show correct document as the viewport mode changes
  useEffect(() => {
    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`
    if (viewportMode === "edit") {
      client?.connectToDocument(staticDocument, url);
    } else if (localDocument) {
      client?.connectToDocument(localDocument, url);
    }
    console.log("FloatingClient connecting to document", viewportMode);
  }, [viewportMode, staticDocument, localDocument, client]);

  useEffect(() => {
    let disposed = false;
    let runnerClient: MMLWebClient | null = null;

    createMMLGameClient().then(async (runnerClientParam: MMLWebClient) => {
      runnerClient = runnerClientParam;
      if (disposed) {
        runnerClient.dispose();
        return;
      }

      setClient(runnerClient);

      // Expose remote holder to project and watch for DOM mutations
      setTimeout(() => {
        if (disposed) return;

          setRemoteHolderElement(runnerClient!.remoteDocumentHolder);
          const mutationListener = () => {
            if (disposed) return;
              incrementStaticDocumentRevision();
          };
          const mutationObserver = new MutationObserver(mutationListener);
          mutationObserver.observe(runnerClient!.remoteDocumentHolder, {
            childList: true,
            attributes: true,
            subtree: true,
          });
      }, 50);
    });

    return () => {
      disposed = true;
      if (runnerClient) {
        runnerClient.dispose();
        setClient(null);
      }
    };
  }, []);



  useEffect(() => {
    window.addEventListener("resize", fitContainer);
    window.addEventListener("editor-layout", fitContainer);

    return () => {
      window.removeEventListener("resize", fitContainer);
      window.removeEventListener("editor-layout", fitContainer);
    };
  }, [client, fitContainer]);

  useEffect(() => {
    if (elementRef.current && client) {
      elementRef.current.appendChild(client.element);
      fitContainer();
    }
  }, [client, fitContainer, elementRef]);

  return (
  <div className="h-full w-full relative mobile-safe-top mobile-safe-left">
    <div ref={elementRef} className="h-full min-h-0 min-w-0 relative"></div>
  </div>
  );
}

export default EditorClient;
