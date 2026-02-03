import { PreviewToolbar, useToolbarStore } from "@mml-io/mml-editor-core";
import React, { useEffect } from "react";

import { CodeEditor } from "./components/CodeEditor";
import ElementSettingsPanel from "./components/ElementSettingsPanel";
import EditorClient from "./components/FloatingClient";
import { ScenePanel } from "./components/ScenePanel";
import { useEditorStore } from "./state/editorStore";

export const App = () => {
  const { code, setCode } = useEditorStore();
  const setReady = useToolbarStore((s) => s.setReady);

  // Set initial demo code if none exists
  useEffect(() => {
    if (!code) {
      setCode(`<m-light y="50" x="-50" z="50" intensity="10000" type="point"></m-light>
<m-light y="50" x="50" z="50" intensity="10000" type="point"></m-light>
<m-light y="50" x="-50" z="-50" intensity="10000" type="point"></m-light>
<m-light y="50" x="50" z="-50" intensity="10000" type="point"></m-light>

<m-cube id="clickable-cube" y="1" color="red" collide="true" z="-2"></m-cube>

  <m-attr-anim attr="ry" start="0" end="360" duration="3000"></m-attr-anim>
</m-model>

<m-cube id="color-cube" x="4" y="1" width="1" color="green" collide="true" z="-2" castshadow="true"></m-cube>

<script>
  const clickableCube = document.getElementById("clickable-cube");
  clickableCube.addEventListener("click", () => {
    console.log("clicked");
    clickableCube.setAttribute("color", "#" + Math.floor(Math.random() * 16777215).toString(16));
  });
</script>`);
    }
    setReady(true);
  }, [code, setCode, setReady]);

  return (
    <div className="flex flex-row w-screen h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Editor Pane */}
      <div className="flex-[1.2] flex flex-col border-r-2 border-[var(--color-border)] bg-[var(--color-panel)] min-w-[320px]">
        <div className="h-10 flex items-center px-4 border-b-2 border-[var(--color-border)] text-sm font-bold text-[var(--color-text)] uppercase tracking-widest bg-[var(--color-bg)]">
          Editor
        </div>
        <div className="flex-1 relative overflow-hidden">
          <CodeEditor />
        </div>
      </div>

      {/* Preview Pane */}
      <div className="flex-[1.4] flex flex-col relative bg-black min-w-[360px]">
        <PreviewToolbar title="Preview" />
        <div className="flex-1 bg-black overflow-hidden relative flex">
          <div className="flex-1 flex justify-center items-center">
            <EditorClient />
          </div>
          <div className="w-[320px] max-w-[360px] min-w-[280px] border-l-2 border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col">
            <ScenePanel className="flex-1 min-h-0 bg-[var(--color-panel)] text-xs text-[var(--color-text)]/80 flex flex-col" />
            <ElementSettingsPanel className="flex-1 min-h-0 border-t-2 border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col" />
          </div>
        </div>
      </div>
    </div>
  );
};
