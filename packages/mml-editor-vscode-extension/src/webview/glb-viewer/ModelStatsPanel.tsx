import React from "react";

import { SectionHeader, StatRow, TextureThumbnail } from "../components";
import { formatBytes, formatNumber } from "../utils/formatting";
import { SLOT_LABELS } from "./constants";
import type { ModelStats, SkeletonInfo, TextureInfo } from "./types";

interface ModelStatsPanelProps {
  stats: ModelStats | null;
  fileName: string;
  skeletonInfo: SkeletonInfo | null;
  collapsedSections: Set<string>;
  onToggleSection: (section: string) => void;
  onSelectTexture: (texture: TextureInfo) => void;
}

export function ModelStatsPanel({
  stats,
  fileName,
  skeletonInfo,
  collapsedSections,
  onToggleSection,
  onSelectTexture,
}: ModelStatsPanelProps) {
  if (!stats) {
    return <div className="text-[var(--color-text-muted)] italic">No model loaded</div>;
  }

  return (
    <>
      {/* File Info */}
      <div className="mb-3">
        <SectionHeader
          title="File"
          collapsed={collapsedSections.has("file")}
          onToggle={() => onToggleSection("file")}
        />
        {!collapsedSections.has("file") && (
          <div className="text-[10px]">
            <div className="mb-1 truncate text-[var(--color-text)]" title={fileName}>
              {fileName}
            </div>
            <StatRow label="Size" value={formatBytes(stats.fileSize)} />
          </div>
        )}
      </div>

      {/* Geometry */}
      <div className="mb-3">
        <SectionHeader
          title="Geometry"
          collapsed={collapsedSections.has("geometry")}
          onToggle={() => onToggleSection("geometry")}
        />
        {!collapsedSections.has("geometry") && (
          <div className="text-[10px]">
            <StatRow label="Vertices" value={formatNumber(stats.vertices)} />
            <StatRow label="Triangles" value={formatNumber(stats.triangles)} />
            <StatRow label="Meshes" value={stats.meshes} />
            <StatRow label="Materials" value={stats.materials} />
          </div>
        )}
      </div>

      {/* Bounding Box */}
      {stats.boundingBox && (
        <div className="mb-3">
          <SectionHeader
            title="Bounds"
            collapsed={collapsedSections.has("bounds")}
            onToggle={() => onToggleSection("bounds")}
          />
          {!collapsedSections.has("bounds") && (
            <div className="text-[10px]">
              <StatRow label="X" value={stats.boundingBox.size.x.toFixed(3)} />
              <StatRow label="Y" value={stats.boundingBox.size.y.toFixed(3)} />
              <StatRow label="Z" value={stats.boundingBox.size.z.toFixed(3)} />
            </div>
          )}
        </div>
      )}

      {/* Rapier Collider */}
      {(stats.colliderVertices > 0 || stats.colliderTriangles > 0) && (
        <div className="mb-3">
          <SectionHeader
            title="Collider"
            collapsed={collapsedSections.has("collider")}
            onToggle={() => onToggleSection("collider")}
          />
          {!collapsedSections.has("collider") && (
            <div className="text-[10px]">
              <StatRow label="Vertices" value={formatNumber(stats.colliderVertices)} />
              <StatRow label="Triangles" value={formatNumber(stats.colliderTriangles)} />
            </div>
          )}
        </div>
      )}

      {/* Skeleton Info */}
      {skeletonInfo?.isRigged && (
        <div className="mb-3">
          <SectionHeader
            title="Skeleton"
            collapsed={collapsedSections.has("skeleton")}
            onToggle={() => onToggleSection("skeleton")}
          />
          {!collapsedSections.has("skeleton") && (
            <div className="text-[10px]">
              <StatRow label="Bones" value={skeletonInfo.boneCount} />
              {skeletonInfo.rootBone && <StatRow label="Root" value={skeletonInfo.rootBone} />}
              <details className="mt-1.5">
                <summary className="cursor-pointer text-[9px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                  View all bone names
                </summary>
                <div className="mt-1 max-h-32 overflow-y-auto rounded bg-[var(--color-border)]/10 p-1.5 text-[9px] font-mono text-[var(--color-text-muted)]">
                  {Array.from(skeletonInfo.boneNames)
                    .sort()
                    .map((name) => (
                      <div key={name} className="truncate">
                        {name}
                      </div>
                    ))}
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* Textures */}
      {stats.textures.length > 0 && (
        <div className="mb-3">
          <SectionHeader
            title={`Textures (${stats.textures.length})`}
            collapsed={collapsedSections.has("textures")}
            onToggle={() => onToggleSection("textures")}
          />
          {!collapsedSections.has("textures") && (
            <div className="space-y-1.5">
              {stats.textures.map((tex, i) => (
                <TextureThumbnail
                  key={i}
                  texture={tex}
                  slotLabel={SLOT_LABELS[tex.slot] || tex.slot}
                  onClick={() => onSelectTexture(tex)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
