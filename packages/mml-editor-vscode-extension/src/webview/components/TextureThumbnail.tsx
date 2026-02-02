import React from "react";

interface TextureInfo {
  name: string;
  width: number;
  height: number;
  slot: string;
  thumbnailUrl: string | null;
}

interface TextureThumbnailProps {
  texture: TextureInfo;
  slotLabel: string;
  onClick: () => void;
}

export function TextureThumbnail({ texture, slotLabel, onClick }: TextureThumbnailProps) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded bg-[var(--color-border)]/20 p-1.5 text-left hover:bg-[var(--color-border)]/40"
      onClick={onClick}
    >
      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded border border-[var(--color-border)]/40 bg-[var(--color-bg)]">
        {texture.thumbnailUrl ? (
          <img
            src={texture.thumbnailUrl}
            alt={texture.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[8px] text-[var(--color-text-muted)]">
            N/A
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] text-[var(--color-text)]">{texture.name}</div>
        <div className="text-[9px] text-[var(--color-accent)]">{slotLabel}</div>
        <div className="text-[9px] text-[var(--color-text-muted)]">
          {texture.width}x{texture.height}
        </div>
      </div>
    </button>
  );
}
