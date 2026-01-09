import React from "react";
import { createRoot } from "react-dom/client";

import { PreviewApp } from "./preview/PreviewApp";

const mount = document.getElementById("__mml_preview_react_root");
if (!mount) {
  throw new Error("Missing __mml_preview_react_root element in webview HTML");
}

createRoot(mount).render(React.createElement(PreviewApp));
