import React, { useCallback, useEffect, useMemo, useState } from "react";

import { bodyFromRemoteHolderElement, elementToPath, pathsEqual } from "../lib/domUtils";
import { useEditorStore } from "../state/editorStore";

type SceneNodeProps = {
  element: HTMLElement;
  path: number[];
  depth: number;
  selectedPaths: number[][];
  structureVersion: number;
  onSelect: (element: HTMLElement, event: React.MouseEvent) => void;
};

function SceneNode({ element, path, depth, selectedPaths, structureVersion, onSelect }: SceneNodeProps) {
  const [collapsed, setCollapsed] = useState(false);

  const children = useMemo(
    () => Array.from(element.children) as HTMLElement[],
    [element, structureVersion],
  );

  const isSelected = selectedPaths.some((p) => pathsEqual(p, path));

  const tagRaw = element.tagName.toLowerCase();
  const idPart = element.id ? `#${element.id}` : "";
  const classPart = element.classList.length
    ? " " + Array.from(element.classList).map((c) => "." + c).join(" ")
    : "";
  const rawTitle = `<${tagRaw}${idPart}${classPart}>`;

  const humanizeTag = (tag: string) =>
    tag
      .replace(/^m-/, "")
      .split("-")
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

  const humanizeName = (value: string) =>
    value
      .replace(/[-_]+/g, " ")
      .replace(/([A-Za-z])(?=\d)|(\d)(?=[A-Za-z])/g, "$& ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const baseLabel = humanizeTag(tagRaw);
  const qualifier = element.id
    ? humanizeName(element.id)
    : element.classList.length
      ? humanizeName(Array.from(element.classList)[0])
      : "";
  const label = qualifier ? `${baseLabel} (${qualifier})` : baseLabel;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer text-xs transition-colors ${
          isSelected
            ? "bg-[var(--color-border)] text-white"
            : "text-[var(--color-text)]/70 hover:bg-[var(--color-border)]/10"
        }`}
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(element, event);
        }}
        title={rawTitle}
      >
        {children.length > 0 && (
          <button
            className="w-4 h-4 grid place-items-center rounded hover:bg-[var(--color-border)]/20 text-[10px] text-[var(--color-text)]/70"
            onClick={(event) => {
              event.stopPropagation();
              setCollapsed((value) => !value);
            }}
            aria-label={collapsed ? "Expand" : "Collapse"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            <svg viewBox="0 0 16 16" className="w-3 h-3" aria-hidden="true">
              {collapsed ? (
                <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        )}
        <span className="truncate">{label}</span>
        {children.length > 0 && (
          <span className="ml-auto text-[10px] text-[var(--color-text)]/40">{children.length}</span>
        )}
      </div>
      {!collapsed && children.length > 0 && (
        <div>
          {children.map((child, index) => (
            <SceneNode
              key={`${path.join("-")}-${index}`}
              element={child}
              path={[...path, index]}
              depth={depth + 1}
              selectedPaths={selectedPaths}
              structureVersion={structureVersion}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type ScenePanelProps = {
  className?: string;
};

export function ScenePanel({ className }: ScenePanelProps) {
  const { remoteHolderElement, pathSelection, setSelectedPaths, clearSelection } = useEditorStore();

  const [structureVersion, setStructureVersion] = useState(0);

  useEffect(() => {
    setStructureVersion(0);
  }, [remoteHolderElement]);

  useEffect(() => {
    if (!remoteHolderElement) return;

    const body = bodyFromRemoteHolderElement(remoteHolderElement);
    if (!body) return;

    const observer = new MutationObserver(() => {
      setStructureVersion((value) => value + 1);
    });

    observer.observe(body, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [remoteHolderElement]);

  const bodyElement = useMemo(
    () => (remoteHolderElement ? bodyFromRemoteHolderElement(remoteHolderElement) : null),
    [remoteHolderElement, structureVersion],
  );

  const roots = useMemo(
    () => (bodyElement ? (Array.from(bodyElement.children) as HTMLElement[]) : []),
    [bodyElement, structureVersion],
  );

  const handleSelect = useCallback(
    (element: HTMLElement, event: React.MouseEvent) => {
      if (!remoteHolderElement) return;

      const path = elementToPath(remoteHolderElement, element);
      const isMulti = event.metaKey || event.shiftKey || event.ctrlKey;
      const current = useEditorStore.getState().pathSelection.selectedPaths;

      if (isMulti) {
        const exists = current.some((item) => pathsEqual(item, path));
        const next = exists ? current.filter((item) => !pathsEqual(item, path)) : [...current, path];
        setSelectedPaths(next, path);
      } else {
        setSelectedPaths([path], path);
      }
    },
    [remoteHolderElement, setSelectedPaths],
  );

  const containerClass =
    className ??
    "w-72 border-l-2 border-[var(--color-border)] bg-[var(--color-panel)] text-xs text-[var(--color-text)]/80 flex flex-col";

  if (!remoteHolderElement || !bodyElement) {
    return (
      <div className={containerClass}>
        <div className="h-10 px-3 flex items-center border-b-2 border-[var(--color-border)] font-semibold text-[var(--color-text)]">
          Scene
        </div>
        <div className="p-3 text-[var(--color-text)]/60">Scene not ready</div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className="h-10 px-3 flex items-center justify-between border-b-2 border-[var(--color-border)] text-[var(--color-text)]">
        <div className="font-semibold">Scene</div>
        <div className="text-[10px] text-[var(--color-text)]/50">{roots.length} root</div>
      </div>
      <div
        className="flex-1 overflow-auto p-2"
        onClick={() => {
          clearSelection();
        }}
      >
        {roots.length === 0 ? (
          <div className="text-[var(--color-text)]/50 px-2 py-1">Empty scene</div>
        ) : (
          roots.map((element, index) => (
            <SceneNode
              key={`${structureVersion}-${index}`}
              element={element}
              path={[index]}
              depth={0}
              selectedPaths={pathSelection.selectedPaths}
              structureVersion={structureVersion}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

