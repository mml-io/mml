import {
  bodyFromRemoteHolderElement,
  buildSceneData,
  pathsEqual,
  SceneOutlinePanel,
  type SceneNodeData,
} from "@mml-io/mml-editor-core";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useEditorStore } from "../state/editorStore";

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

  const sceneData = useMemo<SceneNodeData[] | null>(() => {
    if (!bodyElement) return null;
    return buildSceneData(bodyElement);
  }, [bodyElement, structureVersion]);

  const handleSelectPath = useCallback(
    (path: number[], additive: boolean) => {
      const current = useEditorStore.getState().pathSelection.selectedPaths;
      if (additive) {
        const exists = current.some((item) => pathsEqual(item, path));
        const next = exists
          ? current.filter((item) => !pathsEqual(item, path))
          : [...current, path];
        setSelectedPaths(next, path);
      } else {
        setSelectedPaths([path], path);
      }
    },
    [setSelectedPaths],
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
        <div className="text-[10px] text-[var(--color-text)]/50">{sceneData?.length ?? 0} root</div>
      </div>
      <div className="flex-1 min-h-0">
        <SceneOutlinePanel
          sceneData={sceneData}
          selectedPaths={pathSelection.selectedPaths}
          onSelectPath={handleSelectPath}
          onClearSelection={() => clearSelection()}
          emptyLabel="Scene not ready"
          emptySceneLabel="Empty scene"
        />
      </div>
    </div>
  );
}
