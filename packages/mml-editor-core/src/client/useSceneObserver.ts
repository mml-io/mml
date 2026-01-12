import { useEffect, useState } from "react";

/**
 * Observes DOM mutations in the MML scene and provides a revision counter
 * that increments on every change. Useful for triggering React re-renders
 * when the scene structure changes.
 *
 * Observes the remoteHolderElement container directly (not the body inside it)
 * so that content reloads that replace the body element are also detected.
 */
export function useSceneObserver(remoteHolderElement: HTMLElement | null): number {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!remoteHolderElement) return;

    // The MML scene lives in an iframe (different JS realm). MutationObserver instances
    // must be created from the same realm as the observed nodes, otherwise mutations
    // may not be reported.
    const view = remoteHolderElement.ownerDocument?.defaultView ?? null;
    const MutationObserverCtor =
      (view?.MutationObserver as typeof MutationObserver | undefined) ?? MutationObserver;
    const raf = view?.requestAnimationFrame?.bind(view) ?? requestAnimationFrame;
    const caf = view?.cancelAnimationFrame?.bind(view) ?? cancelAnimationFrame;

    const bump = () => setRevision((r) => r + 1);
    let rafId: number | null = null;
    let scheduled = false;

    const scheduleBump = () => {
      if (scheduled) return;
      scheduled = true;
      rafId = raf(() => {
        scheduled = false;
        rafId = null;
        bump();
      });
    };

    const observer = new MutationObserverCtor(scheduleBump);
    observer.observe(remoteHolderElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    // Trigger an initial render after attaching the observer.
    bump();

    return () => {
      if (rafId !== null) {
        caf(rafId);
      }
      observer.disconnect();
    };
  }, [remoteHolderElement]);

  return revision;
}
