import React, { useEffect } from "react";
import { CodeEditor } from "./components/CodeEditor";
import ElementSettingsPanel from "./components/ElementSettingsPanel";
import { useEditorStore } from "./state/editorStore";
import EditorClient from "./components/FloatingClient";
import { ScenePanel } from "./components/ScenePanel";

/**
 * Strip all script tags from MML code for static document loading.
 * This prevents script execution in edit mode while preserving the visual elements.
 */
function stripScriptTags(code: string): string {
  return code.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

/**
 * Ensure the provided HTML contains html/body tags for static document loading.
 * If missing, wrap the content with the necessary tags and place code inside body.
 */
function ensureHTMLDocument(code: string): string {
  const hasHtmlTag = /<html[\s>]/i.test(code);
  const hasBodyTag = /<body[\s>]/i.test(code);

  let wrapped = code;

  if (!hasBodyTag) {
    wrapped = `<body>${wrapped}</body>`;
  }

  if (!hasHtmlTag) {
    wrapped = `<html>${wrapped}</html>`;
  }

  return wrapped;
}

/**
 * Eye icon for showing visualizers
 */
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

/**
 * Eye off icon for hiding visualizers
 */
const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>
);

type SnapSelectProps = {
  label: string;
  value: number | null | undefined;
  options: number[];
  suffix?: string;
  onChange: (value: number | null) => void;
};

const SnapSelect = ({ label, value, options, suffix, onChange }: SnapSelectProps) => (
  <label className="flex items-center gap-1 text-[11px] text-[var(--color-text)]/70">
    <span className="uppercase tracking-wide text-[10px] text-[var(--color-text)]/60">{label}</span>
    <select
      className="h-7 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-[11px] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      value={value ?? 0}
      onChange={(event) => {
        const parsed = Number(event.target.value);
        onChange(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
      }}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
    {suffix ? <span className="text-[10px] text-[var(--color-text)]/50">{suffix}</span> : null}
  </label>
);

export const App = () => {
  // Temporary initial code for testing if none supplied
  const {
    code,
    setCode,
    staticDocument,
    visualizersVisible,
    toggleVisualizersVisible,
    snappingEnabled,
    setSnappingEnabled,
    snappingConfig,
    setSnappingConfig,
  } = useEditorStore();
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
    if (!staticDocument || !code) return;

    const timeoutId = setTimeout(() => {
      const sanitized = stripScriptTags(code);
      staticDocument.load(ensureHTMLDocument(sanitized));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [code, staticDocument]);

  return (
    <>
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
          <div className="h-10 flex items-center justify-between px-4 border-b-2 border-[var(--color-border)] text-sm font-bold text-[var(--color-text)] uppercase tracking-widest bg-[var(--color-bg)]">
            <span>Preview</span>
            <div className="flex items-center gap-3 text-[11px] font-normal normal-case tracking-normal">
              <button
                onClick={toggleVisualizersVisible}
                className={`p-1.5 rounded transition-colors ${
                  visualizersVisible
                    ? "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-text-muted)]/20"
                }`}
                title={`${visualizersVisible ? "Hide" : "Show"} element visualizers (G)`}
              >
                {visualizersVisible ? <EyeIcon /> : <EyeOffIcon />}
              </button>
              <div className="w-px h-6 bg-[var(--color-border)]/60" />
              <SnapSelect
                label="Move"
                value={snappingConfig.translation}
                options={[0, 0.01, 0.05, 0.1, 0.5, 1, 10, 100]}
                suffix="m"
                onChange={(value) => setSnappingConfig({ translation: value })}
              />
              <SnapSelect
                label="Rotate"
                value={snappingConfig.rotation}
                options={[0, 1, 5, 10, 15, 30, 45, 90]}
                suffix="°"
                onChange={(value) => setSnappingConfig({ rotation: value })}
              />
              <SnapSelect
                label="Scale"
                value={snappingConfig.scale}
                options={[0, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2]}
                onChange={(value) => setSnappingConfig({ scale: value })}
              />
            </div>
          </div>
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
    </>
  );
};
