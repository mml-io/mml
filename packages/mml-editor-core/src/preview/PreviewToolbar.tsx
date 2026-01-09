import React from "react";

import { EyeIcon, EyeOffIcon } from "./icons";
import { SnapSelect } from "./SnapSelect";
import { useToolbarStore } from "./toolbarStore";

function ToolbarButton({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={[
        "grid place-items-center w-7 h-7 rounded-md border-0",
        "transition-colors cursor-pointer",
        active
          ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
          : "bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/20 hover:text-[var(--color-text)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1.5 h-5 w-px bg-[var(--color-border)]" />;
}

export type PreviewToolbarProps = {
  /** Optional title to show in the toolbar */
  title?: string;
  /** Show sidebar toggle button */
  showSidebarToggle?: boolean;
};

export function PreviewToolbar({ title, showSidebarToggle }: PreviewToolbarProps) {
  const ready = useToolbarStore((s) => s.ready);
  const gizmoMode = useToolbarStore((s) => s.gizmoMode);
  const setGizmoMode = useToolbarStore((s) => s.setGizmoMode);
  const visualizersVisible = useToolbarStore((s) => s.visualizersVisible);
  const toggleVisualizers = useToolbarStore((s) => s.toggleVisualizers);
  const snappingEnabled = useToolbarStore((s) => s.snappingEnabled);
  const toggleSnapping = useToolbarStore((s) => s.toggleSnapping);
  const snappingConfig = useToolbarStore((s) => s.snappingConfig);
  const setSnappingConfig = useToolbarStore((s) => s.setSnappingConfig);
  const sidebarVisible = useToolbarStore((s) => s.sidebarVisible);
  const toggleSidebar = useToolbarStore((s) => s.toggleSidebar);

  return (
    <div className="h-9 flex items-center gap-2 px-2.5 border-b border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] select-none">
      <div className="flex items-center gap-2 min-w-0">
        <div
          title={ready ? "Ready" : "Loading"}
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: ready ? "#22c55e" : "#f97316" }}
        />
        {title ? (
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
            {title}
          </div>
        ) : null}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <ToolbarButton
          active={gizmoMode === "translate"}
          title="Translate (W)"
          onClick={() => setGizmoMode("translate")}
        >
          <span className="text-[11px] font-bold">W</span>
        </ToolbarButton>
        <ToolbarButton
          active={gizmoMode === "rotate"}
          title="Rotate (E)"
          onClick={() => setGizmoMode("rotate")}
        >
          <span className="text-[11px] font-bold">E</span>
        </ToolbarButton>
        <ToolbarButton
          active={gizmoMode === "scale"}
          title="Scale (R)"
          onClick={() => setGizmoMode("scale")}
        >
          <span className="text-[11px] font-bold">R</span>
        </ToolbarButton>
      </div>

      <Divider />

      <ToolbarButton active={snappingEnabled} title="Toggle snapping (X)" onClick={toggleSnapping}>
        <span className="text-[11px] font-bold">X</span>
      </ToolbarButton>

      <ToolbarButton
        active={visualizersVisible}
        title={`${visualizersVisible ? "Hide" : "Show"} visualizers (H/G)`}
        onClick={toggleVisualizers}
      >
        {visualizersVisible ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />}
      </ToolbarButton>

      <div className="flex items-center gap-2.5">
        <SnapSelect
          label="Move"
          value={snappingConfig.translation}
          options={[0.01, 0.05, 0.1, 0.5, 1, 10, 100]}
          suffix="m"
          onChange={(value) => {
            if (value !== null) setSnappingConfig({ translation: value });
          }}
        />
        <SnapSelect
          label="Rotate"
          value={snappingConfig.rotation}
          options={[1, 5, 10, 15, 30, 45, 90]}
          suffix="°"
          onChange={(value) => {
            if (value !== null) setSnappingConfig({ rotation: value });
          }}
        />
        <SnapSelect
          label="Scale"
          value={snappingConfig.scale}
          options={[0.01, 0.05, 0.1, 0.25, 0.5, 1, 2]}
          onChange={(value) => {
            if (value !== null) setSnappingConfig({ scale: value });
          }}
        />
      </div>

      {showSidebarToggle ? (
        <>
          <Divider />
          <ToolbarButton active={sidebarVisible} title="Toggle sidebar" onClick={toggleSidebar}>
            <span className="text-[11px] font-bold">≡</span>
          </ToolbarButton>
        </>
      ) : null}
    </div>
  );
}
