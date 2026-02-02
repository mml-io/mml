import React, { useEffect, useRef, useState } from "react";

import { StatRow, ToggleButton } from "../components";
import { SLOT_LABELS } from "./constants";
import { applyChannelFilterToImageData } from "./texture-utils";
import type { TextureChannel, TextureInfo } from "./types";

interface TexturePreviewModalProps {
  texture: TextureInfo;
  onClose: () => void;
}

export function TexturePreviewModal({ texture, onClose }: TexturePreviewModalProps) {
  const texturePreviewRef = useRef<HTMLDivElement>(null);
  const textureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [textureChannel, setTextureChannel] = useState<TextureChannel>("rgba");
  const [texturePreviewSize, setTexturePreviewSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    setTextureChannel("rgba");
  }, [texture.name, texture.dataUrl]);

  useEffect(() => {
    const container = texturePreviewRef.current;
    if (!container) return;

    const updateSize = () => {
      setTexturePreviewSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!texture.dataUrl) return;
    const container = texturePreviewRef.current;
    const canvas = textureCanvasRef.current;
    if (!container || !canvas) return;

    const width = Math.max(1, Math.floor(texturePreviewSize.width));
    const height = Math.max(1, Math.floor(texturePreviewSize.height));
    if (width <= 1 || height <= 1) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    let canceled = false;

    img.onload = () => {
      if (canceled) return;
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);

      const imgWidth = img.naturalWidth || img.width;
      const imgHeight = img.naturalHeight || img.height;
      if (!imgWidth || !imgHeight) return;

      const scale = Math.min(width / imgWidth, height / imgHeight);
      const drawWidth = Math.max(1, Math.floor(imgWidth * scale));
      const drawHeight = Math.max(1, Math.floor(imgHeight * scale));
      const offsetX = Math.floor((width - drawWidth) / 2);
      const offsetY = Math.floor((height - drawHeight) / 2);

      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      if (textureChannel !== "rgba") {
        const imageData = ctx.getImageData(offsetX, offsetY, drawWidth, drawHeight);
        applyChannelFilterToImageData(imageData, textureChannel);
        ctx.putImageData(imageData, offsetX, offsetY);
      }
    };

    img.src = texture.dataUrl;

    return () => {
      canceled = true;
    };
  }, [texture.dataUrl, textureChannel, texturePreviewSize.width, texturePreviewSize.height]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-[90vw] max-w-none flex-col gap-3 rounded-lg bg-[var(--color-panel)] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium text-[var(--color-text)]">
              {texture.name}
            </h3>
            <div className="text-[11px] text-[var(--color-accent)]">
              {SLOT_LABELS[texture.slot] || texture.slot}
            </div>
          </div>
          <button
            type="button"
            className="rounded bg-[var(--color-border)]/30 px-2.5 py-1 text-[11px] text-[var(--color-text)] hover:bg-[var(--color-border)]/50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex flex-1 min-h-0 gap-4">
          <div
            ref={texturePreviewRef}
            className="relative flex-1 min-w-0 overflow-hidden rounded border border-[var(--color-border)] bg-[repeating-conic-gradient(#333_0%_25%,#444_25%_50%)] bg-[length:16px_16px]"
          >
            {texture.dataUrl ? (
              <canvas ref={textureCanvasRef} className="h-full w-full" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-muted)]">
                Preview unavailable
              </div>
            )}
          </div>

          <div className="flex w-48 flex-shrink-0 flex-col gap-3 text-[10px]">
            <div>
              <div className="mb-1 text-[9px] uppercase tracking-wide text-[var(--color-text-muted)]">
                Channel
              </div>
              <div className="flex flex-wrap gap-1">
                <ToggleButton
                  active={textureChannel === "rgba"}
                  onClick={() => setTextureChannel("rgba")}
                >
                  RGBA
                </ToggleButton>
                <ToggleButton
                  active={textureChannel === "rgb"}
                  onClick={() => setTextureChannel("rgb")}
                >
                  RGB
                </ToggleButton>
                <ToggleButton
                  active={textureChannel === "r"}
                  onClick={() => setTextureChannel("r")}
                >
                  R
                </ToggleButton>
                <ToggleButton
                  active={textureChannel === "g"}
                  onClick={() => setTextureChannel("g")}
                >
                  G
                </ToggleButton>
                <ToggleButton
                  active={textureChannel === "b"}
                  onClick={() => setTextureChannel("b")}
                >
                  B
                </ToggleButton>
                <ToggleButton
                  active={textureChannel === "a"}
                  onClick={() => setTextureChannel("a")}
                >
                  A
                </ToggleButton>
              </div>
            </div>

            <div className="space-y-1">
              <StatRow label="Dimensions" value={`${texture.width} x ${texture.height}`} />
              <StatRow label="Format" value={texture.format} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
