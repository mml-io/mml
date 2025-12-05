import React, { useEffect, useState } from "react";
import { CodeEditor } from "./components/CodeEditor";
import { EditorToHostMessage } from "./lib/host/HostChannel";
import { useEditorStore } from "./state/editorStore";
import EditorClient from "./components/FloatingClient";

export const App = () => {

  useEffect(() => {
    // Setup communication with host (parent window or VS Code webview)
    const sendMessage = (msg: EditorToHostMessage) => {
      // In VS Code webview, acquireVsCodeApi() is used.
      // Here we assume window.postMessage for iframe embedding or similar.
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, "*");
      } else if ((window as any).vscode) {
        (window as any).vscode.postMessage(msg);
      } else {
        console.log("Host message:", msg);
      }
    };


  }, []);

  // Temporary initial code for testing if none supplied
  const { code, setCode, staticDocument } = useEditorStore();
  useEffect(() => {
    if (!code) {
      setCode(`<m-light y="50" x="-50" z="50" intensity="10000" type="point"></m-light>
<m-light y="50" x="50" z="50" intensity="10000" type="point"></m-light>
<m-light y="50" x="-50" z="-50" intensity="10000" type="point"></m-light>
<m-light y="50" x="50" z="-50" intensity="10000" type="point"></m-light>

<m-model x="-2" collide="true" src="https://storage.googleapis.com/ai-game-creator/DamagedHelmet.glb" z="-2" y="1.2" sx="0.5" sy="0.5" sz="0.5"></m-model>

<m-cube id="clickable-cube" y="1" color="red" collide="true" z="-2"></m-cube>

<m-model x="2" z="-2" id="duck" src="https://storage.googleapis.com/ai-game-creator/Stylized-Medical-Professional.glb" y="0.37872010769124587" collide="true">
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
  }, [code, setCode]);

  // when code changes, update the static document
  useEffect(() => {
    if (staticDocument && code) {
      staticDocument.load(code);
    }
  }, [code, staticDocument]);

  return (
    <>
      <div className="flex flex-row w-screen h-screen overflow-hidden bg-[var(--color-bg)]">
        {/* Editor Pane */}
        <div className="flex-1 flex flex-col border-r-2 border-[var(--color-border)] bg-[var(--color-panel)] min-w-[300px]">
          <div className="h-10 flex items-center px-4 border-b-2 border-[var(--color-border)] text-sm font-bold text-[var(--color-text)] uppercase tracking-widest bg-[var(--color-bg)]">
            Editor
          </div>
          <div className="flex-1 relative overflow-hidden">
            <CodeEditor />
          </div>
        </div>
        {/* Preview Pane */}
        <div className="flex-1 flex flex-col relative bg-black">
          <div className="h-10 flex items-center px-4 border-b-2 border-[var(--color-border)] text-sm font-bold text-[var(--color-text)] uppercase tracking-widest bg-[var(--color-bg)]">
            Preview
          </div>
          <div className="h-full bg-black overflow-hidden relative flex justify-center items-center">
            <EditorClient />
          </div>
        </div>
      </div>
    </>
  );
};
