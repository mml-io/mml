import React from "react";

import { SectionHeader } from "../components";
import type {
  AnimationCompatibility,
  ExternalAnimation,
  ExternalAnimationFile,
  SkeletonInfo,
} from "./types";

interface ExternalAnimPanelProps {
  skeletonInfo: SkeletonInfo | null;
  externalFiles: ExternalAnimationFile[];
  externalAnimations: Map<string, ExternalAnimation>;
  animationCompatibility: Map<string, AnimationCompatibility>;
  activeExternalAnimation: { uri: string; clipIndex: number } | null;
  collapsed: boolean;
  loading: boolean;
  onToggle: () => void;
  onScan: () => void;
  onLoadAnimation: (uri: string) => void;
  onRemoveAnimation: (uri: string) => void;
  onPlayAnimation: (uri: string, clipIndex: number) => void;
}

export function ExternalAnimPanel({
  skeletonInfo,
  externalFiles,
  externalAnimations,
  animationCompatibility,
  activeExternalAnimation,
  collapsed,
  loading,
  onToggle,
  onScan,
  onLoadAnimation,
  onRemoveAnimation,
  onPlayAnimation,
}: ExternalAnimPanelProps) {
  if (!skeletonInfo?.isRigged) return null;

  return (
    <div className="mb-3">
      <SectionHeader title="External Animations" collapsed={collapsed} onToggle={onToggle} />
      {!collapsed && (
        <div className="space-y-2">
          {/* Scan button */}
          <button
            type="button"
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1.5 text-[10px] font-medium text-[var(--color-text)] hover:bg-[var(--color-border)]/40"
            onClick={onScan}
            disabled={loading}
          >
            {loading ? "Scanning..." : "Scan Workspace for Animations"}
          </button>

          {/* Animation file selector */}
          {externalFiles.length > 0 && (
            <select
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1 text-[10px] text-[var(--color-text)]"
              onChange={(e) => onLoadAnimation(e.target.value)}
              value=""
            >
              <option value="">Select animation file...</option>
              {externalFiles.map((file) => (
                <option key={file.uri} value={file.uri}>
                  {file.relativePath}
                </option>
              ))}
            </select>
          )}

          {/* Loaded external animations list */}
          {Array.from(externalAnimations.entries()).map(([uri, extAnim]) => (
            <div key={uri} className="rounded bg-[var(--color-border)]/10 p-1.5">
              <div className="mb-1 flex items-center justify-between">
                <span className="flex-1 truncate text-[9px] text-[var(--color-text-muted)]">
                  {extAnim.file.fileName}
                </span>
                <button
                  type="button"
                  className="px-1 text-[9px] text-red-400 hover:text-red-300"
                  onClick={() => onRemoveAnimation(uri)}
                >
                  Remove
                </button>
              </div>

              {/* Compatibility indicator */}
              {(() => {
                const compat = animationCompatibility.get(uri);
                if (!compat) return null;
                return (
                  <div className="mb-1 text-[9px]">
                    {compat.compatible ? (
                      <span className="text-green-400">
                        Compatible ({compat.matchedBones}/{compat.totalBones} bones)
                      </span>
                    ) : (
                      <span className="text-yellow-400">
                        Partial match ({compat.matchedBones}/{compat.totalBones} bones)
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Animation clips from this file */}
              {extAnim.clipInfos.map((clip, clipIdx) => (
                <button
                  key={clipIdx}
                  type="button"
                  className={[
                    "mt-0.5 w-full rounded px-1.5 py-1 text-left text-[10px]",
                    activeExternalAnimation?.uri === uri &&
                    activeExternalAnimation?.clipIndex === clipIdx
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-border)]/20 text-[var(--color-text)] hover:bg-[var(--color-border)]/40",
                  ].join(" ")}
                  onClick={() => onPlayAnimation(uri, clipIdx)}
                >
                  <div className="truncate">{clip.name}</div>
                  <div
                    className={
                      activeExternalAnimation?.uri === uri &&
                      activeExternalAnimation?.clipIndex === clipIdx
                        ? "opacity-70"
                        : "text-[var(--color-text-muted)]"
                    }
                  >
                    {clip.duration.toFixed(2)}s
                  </div>
                </button>
              ))}
            </div>
          ))}

          {/* Empty state */}
          {externalFiles.length === 0 && !loading && (
            <div className="text-[9px] italic text-[var(--color-text-muted)]">
              Click &quot;Scan&quot; to find animation files in your workspace
            </div>
          )}
        </div>
      )}
    </div>
  );
}
