declare function acquireVsCodeApi<T>(): T & {
  postMessage: (message: unknown) => void;
};

import type { SceneNodeData } from "@mml-io/mml-editor-core";
import { SceneOutlinePanel } from "@mml-io/mml-editor-core";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

type IncomingMessage = {
  type: "updateSceneTree";
  sceneData: SceneNodeData[] | null;
  selectedPaths: number[][];
};

const vscode = acquireVsCodeApi<{ postMessage: (message: unknown) => void }>();

function App() {
  const [sceneData, setSceneData] = useState<SceneNodeData[] | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<number[][]>([]);

  useEffect(() => {
    const handler = (event: MessageEvent<IncomingMessage>) => {
      const msg = event.data;
      if (!msg || msg.type !== "updateSceneTree") return;
      setSceneData(msg.sceneData);
      setSelectedPaths(msg.selectedPaths ?? []);
    };
    window.addEventListener("message", handler as any);
    return () => window.removeEventListener("message", handler as any);
  }, []);

  return (
    <SceneOutlinePanel
      sceneData={sceneData}
      selectedPaths={selectedPaths}
      onSelectPath={(path, additive) =>
        vscode.postMessage({ type: "selectElement", path, addToSelection: additive })
      }
      onClearSelection={() => vscode.postMessage({ type: "clearSelection" })}
    />
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
