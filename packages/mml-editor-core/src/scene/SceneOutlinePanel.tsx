import React, { useMemo, useState } from "react";

import type { SceneNodeData } from "../shared/types";

const pathKey = (path: number[]) => path.join(".");
const pathsEqual = (a: number[], b: number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);
const isSelected = (selected: number[][], path: number[]) =>
  selected.some((p) => pathsEqual(p, path));

export function SceneOutlinePanel({
  sceneData,
  selectedPaths,
  onSelectPath,
  onClearSelection,
  emptyLabel = "No MML preview active",
  emptySceneLabel = "Empty scene",
}: {
  sceneData: SceneNodeData[] | null;
  selectedPaths: number[][];
  onSelectPath: (path: number[], additive: boolean) => void;
  onClearSelection: () => void;
  emptyLabel?: string;
  emptySceneLabel?: string;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  // Reset collapsed state when the root changes significantly (cheap heuristic).
  const sceneRootKey = useMemo(
    () => (sceneData ? `${sceneData.length}:${sceneData.map((n) => n.tagName).join(",")}` : "none"),
    [sceneData],
  );
  React.useEffect(() => {
    setCollapsed(new Set());
  }, [sceneRootKey]);

  if (sceneData === null) {
    return <div className="p-3 text-[var(--color-text-muted)] italic">{emptyLabel}</div>;
  }

  if (!sceneData || sceneData.length === 0) {
    return <div className="p-3 text-[var(--color-text-muted)] italic">{emptySceneLabel}</div>;
  }

  const renderNode = (node: SceneNodeData, depth: number) => {
    const key = pathKey(node.path);
    const hasChildren = node.children.length > 0;
    const collapsedHere = collapsed.has(key);
    const selected = isSelected(selectedPaths, node.path);

    return (
      <div key={key}>
        <div
          className={[
            "flex items-center gap-1.5 rounded px-2 py-1 select-none cursor-pointer",
            "hover:bg-[var(--color-border)]/20",
            selected
              ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
              : "text-[var(--color-text)]",
          ].join(" ")}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectPath(node.path, e.metaKey || e.ctrlKey || e.shiftKey);
          }}
          title={`${node.tagName}${node.id ? `#${node.id}` : ""}`}
        >
          <button
            type="button"
            aria-label={hasChildren ? (collapsedHere ? "Expand" : "Collapse") : "No children"}
            disabled={!hasChildren}
            onClick={(e) => {
              e.stopPropagation();
              if (!hasChildren) return;
              setCollapsed((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            }}
            className={[
              "grid place-items-center w-4 h-4 p-0 border-0 bg-transparent",
              "text-[var(--color-text-muted)]",
              hasChildren ? "cursor-pointer" : "cursor-default invisible",
            ].join(" ")}
          >
            <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
              {collapsedHere ? (
                <path
                  d="M6 3l5 5-5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M3 6l5 5 5-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>
          <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {node.tagName}
            {node.id ? `#${node.id}` : ""}
          </span>
          {hasChildren && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {node.children.length}
            </span>
          )}
        </div>
        {hasChildren && !collapsedHere && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div
      className="w-full h-full overflow-auto bg-[var(--color-panel)] text-[var(--color-text)]"
      onClick={() => onClearSelection()}
    >
      <div className="p-2">{sceneData.map((node) => renderNode(node, 0))}</div>
    </div>
  );
}
