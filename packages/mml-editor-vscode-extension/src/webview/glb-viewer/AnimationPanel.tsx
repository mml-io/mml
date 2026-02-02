import React from "react";

import { SectionHeader } from "../components";
import type { AnimationInfo } from "./types";

interface AnimationPanelProps {
  animations: AnimationInfo[];
  activeIndex: number;
  collapsed: boolean;
  onToggle: () => void;
  onPlayAnimation: (index: number) => void;
}

export function AnimationPanel({
  animations,
  activeIndex,
  collapsed,
  onToggle,
  onPlayAnimation,
}: AnimationPanelProps) {
  if (animations.length === 0) return null;

  const maxDuration = Math.max(...animations.map((a) => a.duration), 1);

  return (
    <div className="mb-3">
      <SectionHeader
        title={`Animations (${animations.length})`}
        collapsed={collapsed}
        onToggle={onToggle}
      />
      {!collapsed && (
        <div className="space-y-1">
          {animations.map((anim, i) => {
            const widthPercent = (anim.duration / maxDuration) * 100;

            return (
              <button
                type="button"
                key={i}
                className={[
                  "relative w-full overflow-hidden rounded px-1.5 py-1.5 text-left text-[10px]",
                  activeIndex === i
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-border)]/20 text-[var(--color-text)] hover:bg-[var(--color-border)]/40",
                ].join(" ")}
                onClick={() => onPlayAnimation(i)}
              >
                {/* Duration bar visualization */}
                <div
                  className={[
                    "absolute left-0 top-0 h-full",
                    activeIndex === i ? "bg-white/20" : "bg-[var(--color-accent)]/20",
                  ].join(" ")}
                  style={{ width: `${widthPercent}%` }}
                />
                <div className="relative flex items-center justify-between gap-2">
                  <span className="flex-1 truncate">{anim.name}</span>
                  <span
                    className={activeIndex === i ? "opacity-70" : "text-[var(--color-text-muted)]"}
                  >
                    {anim.duration.toFixed(2)}s
                  </span>
                </div>
                <div
                  className={[
                    "relative text-[9px]",
                    activeIndex === i ? "opacity-60" : "text-[var(--color-text-muted)]",
                  ].join(" ")}
                >
                  {anim.trackCount} tracks
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
