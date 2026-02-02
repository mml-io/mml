import React from "react";
import { createRoot } from "react-dom/client";

import { GlbViewer } from "./glb-viewer";

const rootElement = document.getElementById("__glb_viewer_root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <GlbViewer />
    </React.StrictMode>,
  );
}
