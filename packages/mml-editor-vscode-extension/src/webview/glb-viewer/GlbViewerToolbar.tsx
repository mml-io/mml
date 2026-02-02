import React from "react";

import { ToggleButton } from "../components";

interface GlbViewerToolbarProps {
  showBounds: boolean;
  onToggleBounds: () => void;
  showWireframe: boolean;
  onToggleWireframe: () => void;
  showCollider: boolean;
  onToggleCollider: () => void;
  showSkeleton: boolean;
  onToggleSkeleton: () => void;
  hasSkeleton: boolean;
  onResetCamera: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function GlbViewerToolbar({
  showBounds,
  onToggleBounds,
  showWireframe,
  onToggleWireframe,
  showCollider,
  onToggleCollider,
  showSkeleton,
  onToggleSkeleton,
  hasSkeleton,
  onResetCamera,
  sidebarCollapsed,
  onToggleSidebar,
}: GlbViewerToolbarProps) {
  return (
    <div className="flex h-9 flex-shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-panel)] px-2.5">
      {/* Left side - view controls */}
      <div className="flex items-center gap-1">
        <ToggleButton active={showBounds} onClick={onToggleBounds}>
          Bounds
        </ToggleButton>
        <ToggleButton active={showWireframe} onClick={onToggleWireframe}>
          Wireframe
        </ToggleButton>
        <ToggleButton active={showCollider} onClick={onToggleCollider}>
          Collider
        </ToggleButton>
        {hasSkeleton && (
          <ToggleButton active={showSkeleton} onClick={onToggleSkeleton}>
            Skeleton
          </ToggleButton>
        )}
        <button
          type="button"
          className="rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1 text-[10px] font-medium text-[var(--color-text)] hover:bg-[var(--color-border)]/40"
          onClick={onResetCamera}
        >
          Reset
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ToggleButton active={!sidebarCollapsed} onClick={onToggleSidebar}>
          <span className="text-[11px] font-bold">≡</span>
        </ToggleButton>
      </div>
    </div>
  );
}
