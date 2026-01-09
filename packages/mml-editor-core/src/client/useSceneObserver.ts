import { useEffect, useState } from "react";

import { bodyFromRemoteHolderElement } from "../shared/remoteHolderUtils";

/**
 * Observes DOM mutations in the MML scene and provides a revision counter
 * that increments on every change. Useful for triggering React re-renders
 * when the scene structure changes.
 */
export function useSceneObserver(remoteHolderElement: HTMLElement | null): number {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!remoteHolderElement) return;

    let cancelled = false;
    let observer: MutationObserver | null = null;
    let retryTimer: number | null = null;

    const bump = () => setRevision((r) => r + 1);

    const tryAttach = () => {
      if (cancelled) return;
      const body = bodyFromRemoteHolderElement(remoteHolderElement);
      if (!body) {
        retryTimer = window.setTimeout(tryAttach, 500);
        return;
      }

      observer = new MutationObserver(bump);
      observer.observe(body, { childList: true, subtree: true, attributes: true });
      bump();
    };

    tryAttach();

    return () => {
      cancelled = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      observer?.disconnect();
    };
  }, [remoteHolderElement]);

  return revision;
}
