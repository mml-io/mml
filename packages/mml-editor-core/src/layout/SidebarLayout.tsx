import React, { useCallback, useEffect, useRef } from "react";

export type SidebarLayoutState = {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  scenePanelCollapsed: boolean;
  settingsPanelCollapsed: boolean;
  scenePanelRatio: number; // 0..1, ratio of scene panel height in available height
};

export type SidebarLayoutProps = {
  state: SidebarLayoutState;
  minWidth?: number;
  maxWidth?: number;
  minPanelHeight?: number;

  sceneHeader: { title: string; info?: string };
  settingsHeader: { title: string; info?: string };

  onToggleSceneCollapsed: () => void;
  onToggleSettingsCollapsed: () => void;
  onChangeWidth: (width: number, commit: boolean) => void;
  onChangeRatio: (ratio: number, commit: boolean) => void;

  scene: React.ReactNode;
  settings: React.ReactNode;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function SidebarLayout({
  state,
  minWidth = 180,
  maxWidth = 500,
  minPanelHeight = 60,
  sceneHeader,
  settingsHeader,
  onToggleSceneCollapsed,
  onToggleSettingsCollapsed,
  onChangeWidth,
  onChangeRatio,
  scene,
  settings,
}: SidebarLayoutProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const startSidebarDrag = useCallback(
    (startClientX: number) => {
      const container = containerRef.current;
      if (!container) return;

      const startWidth = state.sidebarWidth;
      const onMove = (e: MouseEvent) => {
        const delta = startClientX - e.clientX; // left edge drag: moving left increases width
        const nextWidth = clamp(startWidth + delta, minWidth, maxWidth);
        onChangeWidth(nextWidth, false);
        e.preventDefault();
      };
      const onUp = (e: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        const delta = startClientX - e.clientX;
        const nextWidth = clamp(startWidth + delta, minWidth, maxWidth);
        onChangeWidth(nextWidth, true);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [maxWidth, minWidth, onChangeWidth, state.sidebarWidth],
  );

  const startSplitDrag = useCallback(
    (startClientY: number) => {
      const container = containerRef.current;
      if (!container) return;
      if (state.scenePanelCollapsed || state.settingsPanelCollapsed) return;

      const availableHeight = container.clientHeight;
      if (availableHeight <= 0) return;

      const startSceneHeight = Math.floor(availableHeight * state.scenePanelRatio);

      const onMove = (e: MouseEvent) => {
        const delta = e.clientY - startClientY;
        const nextSceneHeight = clamp(
          startSceneHeight + delta,
          minPanelHeight,
          availableHeight - minPanelHeight,
        );
        onChangeRatio(nextSceneHeight / availableHeight, false);
        e.preventDefault();
      };
      const onUp = (e: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        const delta = e.clientY - startClientY;
        const nextSceneHeight = clamp(
          startSceneHeight + delta,
          minPanelHeight,
          availableHeight - minPanelHeight,
        );
        onChangeRatio(nextSceneHeight / availableHeight, true);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [
      minPanelHeight,
      onChangeRatio,
      state.scenePanelCollapsed,
      state.scenePanelRatio,
      state.settingsPanelCollapsed,
    ],
  );

  // Prevent stray text selection during drags initiated inside the component.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.dataset?.dragHandle) {
        e.preventDefault();
      }
    };
    el.addEventListener("mousedown", prevent);
    return () => el.removeEventListener("mousedown", prevent);
  }, []);

  if (state.sidebarCollapsed) {
    return null;
  }

  const bothExpanded = !state.scenePanelCollapsed && !state.settingsPanelCollapsed;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)]"
      style={{ width: state.sidebarWidth, minWidth, maxWidth }}
    >
      {/* Left-edge resize handle */}
      <div
        data-drag-handle="sidebar"
        onMouseDown={(e) => {
          e.preventDefault();
          startSidebarDrag(e.clientX);
        }}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize bg-transparent hover:bg-[var(--color-border)]/20"
      />

      <div
        className={bothExpanded ? "flex-1 min-h-0 grid" : "flex-1 min-h-0 flex flex-col"}
        style={
          bothExpanded
            ? { gridTemplateRows: `${state.scenePanelRatio}fr 4px ${1 - state.scenePanelRatio}fr` }
            : undefined
        }
      >
        {/* Scene panel */}
        <div
          className="flex flex-col min-h-0"
          style={{ flex: state.scenePanelCollapsed ? "0 0 auto" : "1 1 auto" }}
        >
          <div
            onClick={onToggleSceneCollapsed}
            className="h-8 px-2.5 flex items-center justify-between border-b border-[var(--color-border)] cursor-pointer select-none hover:bg-[var(--color-border)]/10"
            title="Click to collapse/expand"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {state.scenePanelCollapsed ? "▸" : "▾"}
              </span>
              <span className="text-xs font-semibold">{sceneHeader.title}</span>
            </div>
            {sceneHeader.info ? (
              <span className="text-[11px] text-[var(--color-text-muted)]">{sceneHeader.info}</span>
            ) : null}
          </div>

          {!state.scenePanelCollapsed ? (
            <div className="flex-1 min-h-0 overflow-hidden">{scene}</div>
          ) : null}
        </div>

        {/* Split resize handle */}
        {bothExpanded ? (
          <div
            data-drag-handle="split"
            onMouseDown={(e) => {
              e.preventDefault();
              startSplitDrag(e.clientY);
            }}
            className="h-1 cursor-ns-resize bg-transparent border-y border-[var(--color-border)] hover:bg-[var(--color-border)]/20"
          />
        ) : null}

        {/* Settings panel */}
        <div
          className="flex flex-col min-h-0"
          style={{ flex: state.settingsPanelCollapsed ? "0 0 auto" : "1 1 auto" }}
        >
          <div
            onClick={onToggleSettingsCollapsed}
            className="h-8 px-2.5 flex items-center justify-between border-b border-[var(--color-border)] cursor-pointer select-none hover:bg-[var(--color-border)]/10"
            title="Click to collapse/expand"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {state.settingsPanelCollapsed ? "▸" : "▾"}
              </span>
              <span className="text-xs font-semibold">{settingsHeader.title}</span>
            </div>
            {settingsHeader.info ? (
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {settingsHeader.info}
              </span>
            ) : null}
          </div>

          {!state.settingsPanelCollapsed ? (
            <div className="flex-1 min-h-0 overflow-auto">{settings}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
