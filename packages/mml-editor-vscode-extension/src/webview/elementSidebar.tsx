declare function acquireVsCodeApi<T>(): T & {
  postMessage: (message: unknown) => void;
};

import {
  DEFAULT_SNAPPING_CONFIG,
  ElementSettingsPanel,
  type ElementPropertyData,
  type SelectedElementData,
  type SnappingConfig,
} from "@mml-io/mml-editor-core";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

type IncomingMessage = {
  type: "updateElementSettings";
  selectedElements: SelectedElementData[];
  properties: ElementPropertyData[];
  snappingEnabled: boolean;
  snappingConfig: SnappingConfig;
};

const vscode = acquireVsCodeApi<{ postMessage: (message: unknown) => void }>();

function App() {
  const [selectedElements, setSelectedElements] = useState<SelectedElementData[]>([]);
  const [properties, setProperties] = useState<ElementPropertyData[]>([]);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [snappingConfig, setSnappingConfig] = useState<SnappingConfig>(DEFAULT_SNAPPING_CONFIG);

  useEffect(() => {
    const handler = (event: MessageEvent<IncomingMessage>) => {
      const msg = event.data;
      if (!msg || msg.type !== "updateElementSettings") return;
      setSelectedElements(msg.selectedElements ?? []);
      setProperties(msg.properties ?? []);
      setSnappingEnabled(msg.snappingEnabled ?? true);
      setSnappingConfig(msg.snappingConfig ?? DEFAULT_SNAPPING_CONFIG);
    };
    window.addEventListener("message", handler as any);
    return () => window.removeEventListener("message", handler as any);
  }, []);

  return (
    <ElementSettingsPanel
      selectedElements={selectedElements}
      properties={properties}
      snappingEnabled={snappingEnabled}
      snappingConfig={snappingConfig}
      onUpdateProperty={(propName, value) =>
        vscode.postMessage({ type: "updateProperty", propName, value })
      }
    />
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
